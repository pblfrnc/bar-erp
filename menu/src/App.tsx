import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Beef,
  Beer,
  Cake,
  ChevronRight,
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
import type { Promotion } from '../../client/src/types';
import { applyBestPromotion, describePromotion, isPromotionActiveAt } from '../../client/src/utils/pricing';
import { groupVariants, splitIntoSubgroups, type MenuItem } from './menuLayout';
import type { MenuCategory, MenuProduct, PublishedMenu } from './types';

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
const MAX_HIGHLIGHTS = 10;

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Preço curto para a linha de tamanhos: "R$ 36" / "R$ 36,50"
const brlShort = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: Number.isInteger(v) ? 0 : 2 });

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const categoryIcon = (category: MenuCategory) => CATEGORY_ICONS[category.icon || ''] || UtensilsCrossed;

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

// Preço exibido de um item: com promoção, e o menor tamanho quando há vários ("a partir de")
function itemPrice(item: MenuItem, promotions: Promotion[], now: Date) {
  const options = (item.variants?.map((v) => v.product) || [item.product]).filter((p) => !p.soldOut);
  const list = (options.length > 0 ? options : [item.product]).map((p) => ({ p, ...applyBestPromotion(p, promotions, now) }));
  const best = list.reduce((a, b) => (b.price < a.price ? b : a));
  return { price: best.price, original: best.promotion ? best.p.price : null, promotion: best.promotion, from: Boolean(item.variants) };
}

export default function App() {
  const { storeId, table } = useMemo(readLocation, []);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
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

  const items = useMemo(() => (menu ? groupVariants(menu.products) : []), [menu]);

  // Abas: categorias com itens, comidas antes (o ERP já manda nessa ordem)
  const tabs = useMemo(() => {
    if (!menu) return [];
    return menu.categories
      .map((category) => ({ category, items: items.filter((i) => i.categoryId === category.id) }))
      .filter((t) => t.items.length > 0);
  }, [menu, items]);

  useEffect(() => {
    if (tabs.length === 0) return;
    setActiveCategory((cur) => (cur && tabs.some((t) => t.category.id === cur) ? cur : tabs[0].category.id));
  }, [tabs]);

  useEffect(() => {
    if (!activeCategory) return;
    const chip = chipsRef.current?.querySelector<HTMLElement>(`[data-cat="${activeCategory}"]`);
    chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeCategory]);

  const q = normalize(query.trim());
  const searchResults = useMemo(() => {
    if (!q) return [];
    return tabs
      .map((t) => ({
        category: t.category,
        items: t.items.filter((i) => normalize(`${i.name} ${i.product.name} ${i.description || ''}`).includes(q))
      }))
      .filter((t) => t.items.length > 0);
  }, [tabs, q]);

  const activeTab = tabs.find((t) => t.category.id === activeCategory) || tabs[0];
  const subgroups = useMemo(() => (activeTab ? splitIntoSubgroups(activeTab.items) : []), [activeTab]);

  // Destaques: comidas com foto, primeiro as que estão em promoção agora
  const highlights = useMemo(() => {
    if (!menu || q) return [];
    const hasKinds = menu.categories.some((c) => c.kind);
    const food = new Set(menu.categories.filter((c) => c.kind === 'food').map((c) => c.id));
    return items
      .filter((i) => i.image && !i.soldOut && (!hasKinds || food.has(i.categoryId)))
      .map((i) => ({ i, promo: itemPrice(i, menu.promotions, localNow).promotion ? 0 : 1 }))
      .sort((a, b) => a.promo - b.promo)
      .slice(0, MAX_HIGHLIGHTS)
      .map(({ i }) => i);
  }, [menu, items, q, localNow]);

  const selectTab = (id: string) => {
    setActiveCategory(id);
    // Volta para o começo da lista se o cliente já tinha rolado
    const bar = barRef.current;
    if (bar && window.scrollY > bar.offsetTop) window.scrollTo({ top: bar.offsetTop, behavior: 'smooth' });
  };

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
  const firstDrinkIndex = tabs.findIndex((t) => t.category.kind && t.category.kind !== 'food');

  const renderList = (list: MenuItem[], category: MenuCategory) => (
    <ul className="rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden">
      {list.map((item) => (
        <ItemRow
          key={item.key}
          item={item}
          food={category.kind === 'food'}
          promotions={m.promotions}
          now={localNow}
          onOpen={() => setOpenItem(item)}
        />
      ))}
    </ul>
  );

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

      {!q && (activePromotions.length > 0 || highlights.length > 0) && (
        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
          {activePromotions.length > 0 && (
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
          {highlights.length > 0 && (
            <section>
              <h2 className="text-lg font-black mb-2">Destaques</h2>
              <ul className="no-scrollbar flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 snap-x snap-mandatory">
                {highlights.map((item) => (
                  <HighlightCard key={item.key} item={item} promotions={m.promotions} now={localNow} onOpen={() => setOpenItem(item)} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <div ref={barRef} className="sticky top-0 z-20 mt-3 bg-stone-50/95 dark:bg-stone-950/95 backdrop-blur border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no cardápio"
              className="w-full rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 pl-9 pr-9 py-2.5 text-[15px] outline-none focus:border-amber-500 placeholder:text-stone-400 [&::-webkit-search-cancel-button]:hidden"
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
          {!q && (
            <div ref={chipsRef} role="tablist" className="no-scrollbar flex items-center gap-2 overflow-x-auto py-3 -mx-4 px-4">
              {tabs.map(({ category, items: list }, index) => {
                const Icon = categoryIcon(category);
                const active = activeTab?.category.id === category.id;
                return (
                  <span key={category.id} className="contents">
                    {index === firstDrinkIndex && index > 0 && (
                      <span aria-hidden className="shrink-0 w-px h-6 bg-stone-300 dark:bg-stone-700" />
                    )}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      data-cat={category.id}
                      onClick={() => selectTab(category.id)}
                      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                        active
                          ? 'bg-stone-900 text-white border-stone-900 dark:bg-amber-500 dark:text-stone-950 dark:border-amber-500'
                          : 'bg-white text-stone-700 border-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:border-stone-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {category.name}
                      <span className={`text-xs font-bold ${active ? 'opacity-70' : 'text-stone-400'}`}>{list.length}</span>
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {q && <div className="h-3" />}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {q ? (
          searchResults.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-500">Nada encontrado para "{query}".</p>
          ) : (
            searchResults.map(({ category, items: list }) => (
              <section key={category.id}>
                <h2 className="text-sm font-black uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-2">{category.name}</h2>
                {renderList(list, category)}
              </section>
            ))
          )
        ) : activeTab ? (
          <>
            <h2 className="flex items-center gap-2 text-xl font-black">
              {(() => {
                const Icon = categoryIcon(activeTab.category);
                return (
                  <span className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center">
                    <Icon className="w-[18px] h-[18px]" />
                  </span>
                );
              })()}
              {activeTab.category.name}
            </h2>
            {subgroups.length > 1 && (
              <nav className="no-scrollbar flex gap-2 overflow-x-auto -mx-4 px-4 -mt-2" aria-label="Seções">
                {subgroups.map((g) => (
                  <a
                    key={g.name}
                    href={`#sub-${g.name}`}
                    className="shrink-0 rounded-lg bg-stone-200/70 dark:bg-stone-800 px-2.5 py-1 text-xs font-bold text-stone-700 dark:text-stone-200"
                  >
                    {g.name} <span className="text-stone-400">{g.items.length}</span>
                  </a>
                ))}
              </nav>
            )}
            {subgroups.map((g) => (
              <section key={g.name || 'all'} id={g.name ? `sub-${g.name}` : undefined} className="scroll-mt-36">
                {g.name && <h3 className="text-sm font-black uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-2">{g.name}</h3>}
                {renderList(g.items, activeTab.category)}
              </section>
            ))}
          </>
        ) : (
          <p className="py-12 text-center text-sm text-stone-500">Nenhum produto no cardápio ainda.</p>
        )}

        <footer className="pt-2 pb-8 text-center text-xs text-stone-500 dark:text-stone-400 space-y-1">
          <p className="font-semibold text-stone-700 dark:text-stone-300">Para pedir, chame o garçom.</p>
          <p className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Atualizado em {updatedAt.toLocaleDateString('pt-BR')} às{' '}
            {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · preços sujeitos a alteração
          </p>
        </footer>
      </main>

      {openItem && <ProductSheet item={openItem} promotions={m.promotions} now={localNow} onClose={() => setOpenItem(null)} />}
    </div>
  );
}

// Foto do produto; se não carregar (sem internet, foto apagada), some sem quebrar o layout
function ProductImage({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={className} />;
}

function SoldOutBadge() {
  return (
    <span className="rounded-md bg-stone-200 dark:bg-stone-800 px-1.5 py-0.5 text-[10px] font-black uppercase text-stone-600 dark:text-stone-300">
      Esgotado
    </span>
  );
}

// Preço em destaque à direita (como no iFood); "a partir de" quando há tamanhos
function PriceColumn({ item, promotions, now }: { item: MenuItem; promotions: Promotion[]; now: Date }) {
  const { price, original, promotion, from } = itemPrice(item, promotions, now);
  return (
    <div className="shrink-0 flex flex-col items-end text-right leading-tight">
      {from && <span className="text-[10px] font-semibold text-stone-400">a partir de</span>}
      <span className={`text-[17px] font-black whitespace-nowrap ${promotion ? 'text-emerald-700 dark:text-emerald-400' : 'text-stone-900 dark:text-white'}`}>
        {brl(price)}
      </span>
      {original !== null && <span className="text-xs text-stone-400 line-through whitespace-nowrap">{brl(original)}</span>}
    </div>
  );
}

// Linha de tamanhos: "P R$ 36 · M R$ 48 · G R$ 60"
function SizesLine({ item, promotions, now }: { item: MenuItem; promotions: Promotion[]; now: Date }) {
  if (!item.variants) return null;
  return (
    <p className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-stone-500 dark:text-stone-400">
      {item.variants.map(({ label, product }) => {
        const { price, promotion } = applyBestPromotion(product, promotions, now);
        return (
          <span key={product.id} className={product.soldOut ? 'line-through opacity-60' : ''}>
            <span className="font-black text-stone-700 dark:text-stone-200">{label}</span>{' '}
            <span className={promotion ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : ''}>{brlShort(price)}</span>
          </span>
        );
      })}
    </p>
  );
}

function ItemRow({
  item,
  food,
  promotions,
  now,
  onOpen
}: {
  item: MenuItem;
  food: boolean;
  promotions: Promotion[];
  now: Date;
  onOpen: () => void;
}) {
  const { promotion } = itemPrice(item, promotions, now);
  const box = item.variants ? null : item.product.box;
  return (
    <li className={item.soldOut ? 'opacity-55' : ''}>
      <button type="button" onClick={onOpen} className="w-full flex items-start gap-3 px-3 py-2.5 text-left">
        <ProductImage
          src={item.image}
          alt={item.name}
          className={`${food ? 'w-16 h-16' : 'w-12 h-12'} shrink-0 rounded-xl object-cover bg-stone-100 dark:bg-stone-800`}
        />
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-[15px] leading-snug">{item.name}</h4>
          {item.description && (
            <p className="mt-0.5 text-[13px] leading-snug text-stone-500 dark:text-stone-400 line-clamp-2">{item.description}</p>
          )}
          <SizesLine item={item} promotions={promotions} now={now} />
          {box && (
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              Caixa c/ {box.quantity}: <span className="font-semibold text-stone-700 dark:text-stone-200">{brl(box.price)}</span>
            </p>
          )}
          {(item.soldOut || promotion) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {item.soldOut && <SoldOutBadge />}
              {promotion && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="w-3 h-3" />
                  {promotion.name}
                </span>
              )}
            </div>
          )}
        </div>
        <PriceColumn item={item} promotions={promotions} now={now} />
        {(item.product.groups.length > 0 || item.variants) && (
          <ChevronRight className="w-4 h-4 shrink-0 self-center text-stone-300 dark:text-stone-600" />
        )}
      </button>
    </li>
  );
}

function HighlightCard({ item, promotions, now, onOpen }: { item: MenuItem; promotions: Promotion[]; now: Date; onOpen: () => void }) {
  const { price, original, promotion, from } = itemPrice(item, promotions, now);
  return (
    <li className="snap-start shrink-0 w-44">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden"
      >
        <div className="relative aspect-[4/3] bg-stone-100 dark:bg-stone-800">
          <ProductImage src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
          {promotion && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
              <Sparkles className="w-3 h-3" />
              Promoção
            </span>
          )}
        </div>
        <div className="p-2.5">
          <p className="font-bold text-sm leading-snug line-clamp-2 min-h-[2.5em]">{item.name}</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            {from && <span className="text-[10px] font-semibold text-stone-400">a partir de</span>}
            <span className={`font-black text-[15px] ${promotion ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>{brl(price)}</span>
            {original !== null && <span className="text-xs text-stone-400 line-through">{brl(original)}</span>}
          </p>
        </div>
      </button>
    </li>
  );
}

// Detalhe do produto: foto grande, descrição completa, tamanhos, caixa fechada e adicionais
function ProductSheet({ item, promotions, now, onClose }: { item: MenuItem; promotions: Promotion[]; now: Date; onClose: () => void }) {
  const product: MenuProduct = item.product;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={item.name}>
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-stone-950/60" />
      <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-stone-900 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 w-9 h-9 rounded-full bg-white/90 dark:bg-stone-950/80 text-stone-700 dark:text-stone-200 flex items-center justify-center shadow"
        >
          <X className="w-5 h-5" />
        </button>
        {item.image ? (
          <ProductImage src={item.image} alt={item.name} className="w-full aspect-[4/3] object-cover bg-stone-100 dark:bg-stone-800" />
        ) : (
          <div className="h-14" />
        )}
        <div className="px-5 pt-4 space-y-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap pr-10">
              <h2 className="text-xl font-black leading-tight">{item.name}</h2>
              {item.soldOut && <SoldOutBadge />}
            </div>
            {item.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600 dark:text-stone-300 whitespace-pre-line">{item.description}</p>
            )}
          </div>

          {item.variants ? (
            <ul className="rounded-xl border border-stone-200 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800">
              {item.variants.map(({ label, product: v }) => {
                const { price, promotion } = applyBestPromotion(v, promotions, now);
                return (
                  <li key={v.id} className={`flex items-center justify-between gap-3 px-3 py-2.5 ${v.soldOut ? 'opacity-55' : ''}`}>
                    <span className="font-bold">
                      Tamanho {label}
                      {v.soldOut && <span className="ml-2 align-middle"><SoldOutBadge /></span>}
                    </span>
                    <span className="text-right leading-tight">
                      <span className={`block font-black text-[17px] ${promotion ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>{brl(price)}</span>
                      {promotion && <span className="block text-xs text-stone-400 line-through">{brl(v.price)}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            (() => {
              const { price, original, promotion } = itemPrice(item, promotions, now);
              return (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xl font-black ${promotion ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>{brl(price)}</span>
                  {original !== null && <span className="text-sm text-stone-400 line-through">{brl(original)}</span>}
                  {promotion && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      <Sparkles className="w-3 h-3" />
                      {promotion.name}
                    </span>
                  )}
                </div>
              );
            })()
          )}

          {!item.variants && product.box && (
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Caixa com {product.box.quantity}: <span className="font-bold text-stone-900 dark:text-white">{brl(product.box.price)}</span>
            </p>
          )}
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
          <p className="pt-1 text-center text-xs font-semibold text-stone-500 dark:text-stone-400">Para pedir, chame o garçom.</p>
        </div>
      </div>
    </div>
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
