import { Category, Product } from '../types';
import { escapeHtml, exportHtmlAsPdf } from './pdfExport';

// Folha A4 de balanço de estoque e revisão de preços: impressa, preenchida à mão (contagem e novo preço)
// e depois lançada no sistema.

export type StockSheetOrder = 'alpha' | 'category';

export interface StockSheetOptions {
  storeName: string;
  categoryId: string | 'ALL';
  order: StockSheetOrder;
  showCost: boolean;
}

const brl = (v: number | null | undefined) =>
  v === null || v === undefined || isNaN(v) ? '' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });

export function stockSheetProducts(products: Product[], categories: Category[], opts: Pick<StockSheetOptions, 'categoryId' | 'order'>) {
  const list = products.filter((p) => opts.categoryId === 'ALL' || p.categoryId === opts.categoryId);
  if (opts.order === 'alpha') return [{ category: null as Category | null, products: [...list].sort(byName) }];
  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'))
    .map((category) => ({ category: category as Category | null, products: list.filter((p) => p.categoryId === category.id).sort(byName) }))
    .filter((g) => g.products.length > 0);
}

export function buildStockSheetHtml(products: Product[], categories: Category[], opts: StockSheetOptions) {
  const groups = stockSheetProducts(products, categories, opts);
  const total = groups.reduce((n, g) => n + g.products.length, 0);
  const categoryName = opts.categoryId === 'ALL' ? 'Todas' : categories.find((c) => c.id === opts.categoryId)?.name || '';
  const showCategoryLabel = opts.order === 'alpha' && opts.categoryId === 'ALL';
  const now = new Date();
  const columns = 7 + (opts.showCost ? 1 : 0);

  const row = (p: Product) => {
    const details = [
      showCategoryLabel ? p.category?.name || categories.find((c) => c.id === p.categoryId)?.name || '' : '',
      p.hasBoxPrice && p.boxQuantity ? `Caixa c/ ${p.boxQuantity}${p.boxPrice ? `: ${brl(p.boxPrice)}` : ''}` : ''
    ].filter(Boolean);
    const sub = details.length > 0 ? `<div class="sub">${escapeHtml(details.join(' · '))}</div>` : '';
    const stock = p.trackStock === false ? '<span class="muted">—</span>' : String(p.stock);
    return `<tr>
      <td class="code">${escapeHtml(p.code || '')}</td>
      <td class="name">${escapeHtml(p.name)}${sub}</td>
      <td class="center">${escapeHtml(p.unit || 'un')}</td>
      <td class="num">${stock}</td>
      <td class="blank"></td>
      ${opts.showCost ? `<td class="num">${brl(p.costPrice)}</td>` : ''}
      <td class="num strong">${brl(p.price)}</td>
      <td class="blank"></td>
    </tr>`;
  };

  const body = groups
    .map(
      (g) =>
        (g.category ? `<tr class="group"><td colspan="${columns}">${escapeHtml(g.category.name)} <span>(${g.products.length})</span></td></tr>` : '') +
        g.products.map(row).join('')
    )
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Balanço de estoque</title>
<style>
  @page { size: A4; margin: 10mm 9mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0c0a09; font-size: 8.5pt; }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; padding-bottom: 3mm; border-bottom: 2px solid #0c0a09; margin-bottom: 3mm; }
  h1 { font-size: 14pt; font-weight: 900; }
  .store { font-size: 9pt; font-weight: 700; color: #57534e; }
  .meta { text-align: right; font-size: 8pt; color: #44403c; line-height: 1.5; }
  .meta b { color: #0c0a09; }
  .sign { display: flex; gap: 6mm; margin-bottom: 3mm; font-size: 8pt; color: #44403c; }
  .sign span { flex: 1; border-bottom: 1px solid #a8a29e; padding-bottom: 1mm; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  th { background: #e7e5e4; font-size: 6.8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.01em; padding: 1.6mm 1.4mm; border: 1px solid #a8a29e; text-align: left; }
  td { border: 1px solid #d6d3d1; padding: 1.5mm 1.4mm; vertical-align: middle; height: 7.5mm; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #fafaf9; }
  tr.group td { background: #0c0a09 !important; color: #fff; font-weight: 900; font-size: 9pt; padding: 1.8mm 2mm; height: auto; border-color: #0c0a09; }
  tr.group span { font-weight: 600; opacity: 0.75; }
  .code { font-family: 'Consolas', ui-monospace, monospace; font-size: 7.5pt; color: #57534e; }
  .name { font-weight: 600; line-height: 1.25; }
  .sub { font-size: 7pt; font-weight: 500; color: #78716c; }
  .center { text-align: center; }
  .num { text-align: right; white-space: nowrap; }
  .strong { font-weight: 800; }
  .muted { color: #a8a29e; }
  td.blank { background: #fff !important; border: 1px solid #78716c; }
  th.blank { background: #fde68a; }
  footer { margin-top: 4mm; font-size: 7.5pt; color: #78716c; }
</style>
</head>
<body>
  <header>
    <div>
      <p class="store">${escapeHtml(opts.storeName)}</p>
      <h1>Balanço de estoque e revisão de preços</h1>
    </div>
    <div class="meta">
      Categoria: <b>${escapeHtml(categoryName)}</b> · Ordem: <b>${opts.order === 'alpha' ? 'alfabética' : 'por categoria'}</b><br/>
      <b>${total}</b> ${total === 1 ? 'produto' : 'produtos'} · gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    </div>
  </header>
  <div class="sign"><span>Responsável:</span><span>Data da contagem:</span><span>Conferido por:</span></div>
  <table>
    <colgroup>
      <col style="width: 13mm" />
      <col />
      <col style="width: 9mm" />
      <col style="width: 14mm" />
      <col style="width: 20mm" />
      ${opts.showCost ? '<col style="width: 18mm" />' : ''}
      <col style="width: 19mm" />
      <col style="width: 21mm" />
    </colgroup>
    <thead>
      <tr>
        <th>Cód.</th>
        <th>Produto</th>
        <th class="center">Un.</th>
        <th class="num">Estoque</th>
        <th class="blank">Contagem</th>
        ${opts.showCost ? '<th class="num">Custo</th>' : ''}
        <th class="num">Preço</th>
        <th class="blank">Novo preço</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
  <footer>Preencha "Contagem" com a quantidade conferida e "Novo preço" só quando o preço mudar. Estoque "—" = produto sem controle de estoque.</footer>
</body>
</html>`;
}

export function exportStockSheet(html: string, opts: Pick<StockSheetOptions, 'categoryId'>, categoryName: string) {
  const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  const label = opts.categoryId === 'ALL' ? 'todas as categorias' : categoryName;
  return exportHtmlAsPdf(html, `Balanço de estoque - ${label} - ${date}.pdf`);
}
