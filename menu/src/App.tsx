import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Beef,
  Beer,
  Cake,
  ChevronDown,
  Clock,
  Coffee,
  CupSoda,
  Flame,
  GlassWater,
  IceCream,
  Martini,
  Pizza,
  RefreshCw,
  Salad,
  Sandwich,
  Search,
  Sparkles,
  UtensilsCrossed,
  Wine,
  X
} from 'lucide-react';
import { applyBestPromotion, describePromotion, isPromotionActiveAt } from '../../client/src/utils/pricing';
import type { MenuProduct, PublishedMenu } from './types';

// Ícones mais usados nas categorias do BarERP; os demais caem no talher
const CATEGORY_ICONS: Record<string, typeof Beer> = {
  Beer,
  Wine,
  Martini,
  Flame,
  UtensilsCrossed,
  Beef,
  GlassWater,
  CupSoda,
  Coffee,
  Pizza,
  Sandwich,
  Salad,
  Cake,
  IceCream
};

const REFRESH_MS = 5 * 60 * 1000;
const TICK_MS = 30 * 1000;

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// /m/<loja>?mesa=5
function readLocation() {
  const match = window.location.pathname.match(/^\/m\/([a-zA-Z0-9]+)\/?$/);
  const mesa = new URLSearchParams(window.location.search).get('mesa');
  return { storeId: match ? match[1].toLowerCase() : null, table: mesa && /^\d{1,4}$/.test(mesa) ? mesa : null };
}

// Horário da loja (fuso do PC do bar), não o do celular do cliente
const storeNow = (timezoneOffset: number) =>
  new Date(Date.now() + (new Date().getTimezoneOffset() - timezoneOffset) * 60000);

type LoadState = { status: 'loading' } | { status: 'error'; notFound: boolean } | { status: 'ready'; menu: PublishedMenu };

export default function App() {
  const { storeId, table } = useMemo(readLocation, []);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await fetch(`/api/menu/${storeId}`, { cache: 'no-cache' });
      if (res.status === 404) {
        setState({ status: 'error', notFound: true });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const menu: PublishedMenu = await res.json();
      setState({ status: 'ready', menu });
    } catch {
      // Sem internet: mantém o cardápio que já está na tela
      setState((prev) => (prev.status === 'ready' ? prev : { status: 'error', notFound: false }));
    }
  }, [storeId]);

  useEffect(() => {
    load();
    const refresh = setInterval(load, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [load]);

  const menu = state.status === 'ready' ? state.menu : null;

  useEffect(() => {
    if (menu) document.title = `Cardápio · ${menu.store.name}`;
  }, [menu]);

  const localNow = useMemo(() => (menu ? storeNow(menu.store.timezoneOffset) : new Date()), [menu, now]);

  const activePromotions = useMemo(
    () => (menu ? menu.promotions.filter((p) => isPromotionActiveAt(p, localNow)) : []),
    [menu, localNow]
  );

  const sections = useMemo(() => {
    if (!menu) return [];
    const q = normalize(query.trim());
    return menu.categories
      .map((category) => ({
        category,
        products: menu.products.filter(
          (p) =>
            p.categoryId === category.id &&
            (!q || normalize(p.name).includes(q) || normalize(p.description || '').includes(q))
        )
      }))
      .filter((s) => s.products.length > 0);
  }, [menu, query]);

  // Destaca a categoria visível na lista de atalhos
  useEffect(() => {
    if (sections.length === 0) return;
    setActiveCategory((cur) => (cur && sections.some((s) => s.category.id === cur) ? cur : sections[0].category.id));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveCategory(visible[0].target.id.replace('cat-', ''));
      },
      { rootMargin: '-140px 0px -60% 0px' }
    );
    sections.forEach((s) => {
      const el = document.getElementById(`cat-${s.category.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    if (!activeCategory) return;
    const chip = chipsRef.current?.querySelector<HTMLElement>(`[data-cat="${activeCategory}"]`);
    chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeCategory]);

  if (!storeId) return <Landing />;

  if (state.status === 'loading') return <LoadingScreen />;

  if (state.status === 'error') {
    return (
      <CenterMessage
        title={state.notFound ? 'Cardápio indisponível' : 'Sem conexão'}
        text={
          state.notFound
            ? 'Este cardápio não está publicado no momento. Peça o cardápio ao garçom.'
            : 'Não foi possível carregar o cardápio. Verifique a internet e tente de novo.'
        }
        onRetry={state.notFound ? undefined : () => {
          setState({ status: 'loading' });
          load();
        }}
      />
    );
  }

  const { menu: m } = state;
  const updatedAt = new Date(m.updatedAt);

  return (
    <div className="min-h-screen pb-[env(safe-area-inset-bottom)]">
      <header className="bg-gradient-to-b from-amber-500 to-amber-600 text-stone-950 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-stone-900/70">Cardápio</p>
              <h1 className="text-2xl font-black leading-tight break-words">{m.store.name}</h1>
            </div>
            {table && (
              <span className="shrink-0 rounded-2xl bg-stone-950 text-amber-400 px-3 py-1.5 text-center leading-none">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-200/80">Mesa</span>
                <span className="block text-xl font-black mt-0.5">{table}</span>
              </span>
            )}
          </div>
          {m.store.message && <p className="mt-2 text-sm font-medium text-stone-900/80 whitespace-pre-line">{m.store.message}</p>}
        </div>
      </header>

      <div className="sticky top-0 z-20 bg-stone-50/95 dark:bg-stone-950/95 backdrop-blur border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no cardápio"
              className="w-full rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 pl-9 pr-9 py-2.5 text-[15px] outline-none focus:border-amber-500 placeholder:text-stone-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </label>
          <div ref={chipsRef} className="no-scrollbar flex gap-2 overflow-x-auto py-3 -mx-4 px-4">
            {sections.map(({ category }) => {
              const Icon = CATEGORY_ICONS[category.icon || ''] || UtensilsCrossed;
              const active = activeCategory === category.id;
              return (
                <a
                  key={category.id}
                  href={`#cat-${category.id}`}
                  data-cat={category.id}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                    active
                      ? 'bg-stone-900 text-white border-stone-900 dark:bg-amber-500 dark:text-stone-950 dark:border-amber-500'
                      : 'bg-white text-stone-700 border-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:border-stone-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {category.name}
                </a>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {activePromotions.length > 0 && !query && (
          <section className="rounded-2xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 p-4">
            <h2 className="flex items-center gap-2 text-sm font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
              <Sparkles className="w-4 h-4" />
              Promoções de agora
            </h2>
            <ul className="mt-2 space-y-1.5">
              {activePromotions.map((p) => (
                <li key={p.id} className="text-sm">
                  <span className="font-bold text-stone-900 dark:text-white">{p.name}</span>
                  <span className="text-stone-600 dark:text-stone-300"> · {describePromotion(p)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sections.length === 0 && (
          <p className="py-12 text-center text-sm text-stone-500">
            {query ? `Nada encontrado para "${query}".` : 'Nenhum produto no cardápio ainda.'}
          </p>
        )}

        {sections.map(({ category, products }) => {
          const Icon = CATEGORY_ICONS[category.icon || ''] || UtensilsCrossed;
          return (
            <section key={category.id} id={`cat-${category.id}`}>
              <h2 className="flex items-center gap-2 text-lg font-black mb-2">
                <Icon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                {category.name}
              </h2>
              <ul className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden">
                {products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    menu={m}
                    now={localNow}
                    expanded={expanded === product.id}
                    onToggle={() => setExpanded((cur) => (cur === product.id ? null : product.id))}
                  />
                ))}
              </ul>
            </section>
          );
        })}

        <footer className="pt-2 pb-8 text-center text-xs text-stone-500 dark:text-stone-400 space-y-1">
          <p className="font-semibold text-stone-700 dark:text-stone-300">Para pedir, chame o garçom.</p>
          <p className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Atualizado em {updatedAt.toLocaleDateString('pt-BR')} às{' '}
            {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · preços sujeitos a alteração
          </p>
        </footer>
      </main>
    </div>
  );
}

function ProductRow({
  product,
  menu,
  now,
  expanded,
  onToggle
}: {
  product: MenuProduct;
  menu: PublishedMenu;
  now: Date;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { price, promotion } = applyBestPromotion(product, menu.promotions, now);
  const hasDetails = product.groups.length > 0;

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-[15px] leading-snug">{product.name}</h3>
          {product.soldOut && (
            <span className="rounded-md bg-stone-200 dark:bg-stone-800 px-1.5 py-0.5 text-[10px] font-black uppercase text-stone-600 dark:text-stone-300">
              Esgotado
            </span>
          )}
        </div>
        {product.description && (
          <p className="mt-0.5 text-[13px] leading-snug text-stone-500 dark:text-stone-400 line-clamp-3">{product.description}</p>
        )}
        {promotion && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            <Sparkles className="w-3 h-3" />
            {promotion.name}
          </span>
        )}
        {product.box && (
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Caixa com {product.box.quantity}: <span className="font-semibold text-stone-700 dark:text-stone-200">{brl(product.box.price)}</span>
          </p>
        )}
        {hasDetails && (
          <p className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            {expanded ? 'Ocultar opções' : 'Ver opções e adicionais'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {promotion && <p className="text-xs text-stone-400 line-through">{brl(product.price)}</p>}
        <p className={`font-black text-[15px] ${promotion ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>{brl(price)}</p>
      </div>
    </>
  );

  return (
    <li className={product.soldOut ? 'opacity-55' : ''}>
      {hasDetails ? (
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="w-full flex gap-3 px-4 py-3 text-left">
          {body}
        </button>
      ) : (
        <div className="flex gap-3 px-4 py-3">{body}</div>
      )}
      {hasDetails && expanded && (
        <div className="px-4 pb-4 space-y-3">
          {product.groups.map((g) => (
            <div key={g.name} className="rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-stone-600 dark:text-stone-300">
                {g.name}
                <span className="ml-1.5 font-semibold normal-case tracking-normal text-stone-400">{groupRule(g.min, g.max)}</span>
              </p>
              <ul className="mt-1.5 space-y-1">
                {g.options.map((o) => (
                  <li key={o.name} className="flex justify-between gap-3 text-sm">
                    <span>{o.name}</span>
                    {o.price > 0 && <span className="shrink-0 font-semibold text-stone-600 dark:text-stone-300">+ {brl(o.price)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

function groupRule(min: number, max: number) {
  if (min >= 1 && max === 1) return 'escolha 1';
  if (min >= 1) return max > 0 ? `escolha de ${min} a ${max}` : `escolha pelo menos ${min}`;
  if (max === 1) return 'opcional, até 1';
  return max > 0 ? `opcional, até ${max}` : 'opcional';
}

function LoadingScreen() {
  return (
    <div className="min-h-screen">
      <div className="h-28 bg-amber-500/80 animate-pulse" />
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-stone-200 dark:bg-stone-800 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function CenterMessage({ title, text, onRetry }: { title: string; text: string; onRetry?: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center">
          <UtensilsCrossed className="w-7 h-7 text-stone-950" />
        </div>
        <h1 className="mt-4 text-xl font-black">{title}</h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{text}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-stone-900 dark:bg-amber-500 px-4 py-2.5 text-sm font-bold text-white dark:text-stone-950"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar de novo
          </button>
        )}
      </div>
    </div>
  );
}

function Landing() {
  return (
    <CenterMessage
      title="Cardápio digital"
      text="Aponte a câmera do celular para o QR Code da mesa para ver o cardápio do estabelecimento."
    />
  );
}
