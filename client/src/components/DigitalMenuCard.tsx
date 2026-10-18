import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, ListChecks, Loader2, QrCode, Send, Printer } from 'lucide-react';
import { api } from '../services/api';
import { Category, DigitalMenuStatus } from '../types';
import { buildTableQrSheetHtml, exportTableQrSheet } from '../utils/tableQrSheet';
import { DigitalMenuItemsModal } from './DigitalMenuItemsModal';

const formatDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca';

const INPUT_CLASS =
  'w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl py-2.5 px-3 focus:border-amber-500 outline-none transition';

const Switch: React.FC<{ checked: boolean; onChange: () => void; label: string }> = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer select-none">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-11 h-6 shrink-0 rounded-full transition ${checked ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{label}</span>
  </label>
);

// Cardápio digital: o cliente lê o QR da mesa e vê o cardápio (preços, adicionais e promoções do momento) no celular
export const DigitalMenuCard: React.FC = () => {
  const [status, setStatus] = useState<DigitalMenuStatus | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState('');
  const [messageText, setMessageText] = useState('');
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const [ignoreStock, setIgnoreStock] = useState(false);
  const [siteUrl, setSiteUrl] = useState('');
  const [qrPreview, setQrPreview] = useState('');
  const [busy, setBusy] = useState<'save' | 'publish' | 'qr' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [showItems, setShowItems] = useState(false);

  const electron = (window as any).electronAPI;

  const syncForm = (st: DigitalMenuStatus) => {
    setEnabled(st.enabled);
    setTitle(st.title);
    setMessageText(st.message);
    setHiddenIds(st.hiddenCategoryIds);
    setHideSoldOut(st.hideSoldOut);
    setIgnoreStock(st.ignoreStock);
    setSiteUrl(st.customSiteUrl);
  };

  const load = useCallback(async () => {
    try {
      const [st, cats] = await Promise.all([api.getDigitalMenu(), api.getCategories()]);
      setStatus(st);
      syncForm(st);
      setCategories([...cats].sort((a, b) => a.sortOrder - b.sortOrder));
    } catch {
      // Sem servidor não há o que mostrar
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!status?.menuUrl || !status.enabled) {
      setQrPreview('');
      return;
    }
    QRCode.toString(status.menuUrl, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
      .then(setQrPreview)
      .catch(() => setQrPreview(''));
  }, [status?.menuUrl, status?.enabled]);

  const toggleCategory = (id: string) =>
    setHiddenIds((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));

  const handleSave = async () => {
    setBusy('save');
    setFeedback(null);
    try {
      const { status: st, publishError } = await api.saveDigitalMenu({
        enabled,
        title,
        message: messageText,
        hiddenCategoryIds: hiddenIds,
        hideSoldOut,
        ignoreStock,
        siteUrl
      });
      setStatus(st);
      syncForm(st);
      if (publishError) setFeedback({ type: 'error', text: `Configuração salva, mas não foi possível publicar: ${publishError}` });
      else setFeedback({ type: 'ok', text: st.enabled ? 'Cardápio salvo e publicado.' : 'Cardápio digital desligado e retirado do ar.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao salvar o cardápio digital.' });
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async () => {
    setBusy('publish');
    setFeedback(null);
    try {
      setStatus(await api.publishDigitalMenu());
      setFeedback({ type: 'ok', text: 'Cardápio publicado. Os clientes já veem a versão atual.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao publicar o cardápio.' });
      load();
    } finally {
      setBusy(null);
    }
  };

  const handleQrSheet = async () => {
    if (!status?.menuUrl) return;
    setBusy('qr');
    setFeedback(null);
    try {
      const tables = await api.getTables();
      const html = await buildTableQrSheetHtml(status.menuUrl, status.title || status.defaultTitle, tables);
      const result = await exportTableQrSheet(html);
      if (result.error) setFeedback({ type: 'error', text: result.error });
      else if (result.success) setFeedback({ type: 'ok', text: `QR Codes gerados: ${tables.length} mesas + 1 geral (balcão/entrada).` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao gerar os QR Codes.' });
    } finally {
      setBusy(null);
    }
  };

  const openMenu = () => {
    if (!status?.menuUrl) return;
    if (typeof electron?.openExternal === 'function') electron.openExternal(status.menuUrl);
    else window.open(status.menuUrl, '_blank', 'noopener');
  };

  const copyLink = async () => {
    if (!status?.menuUrl) return;
    try {
      await navigator.clipboard.writeText(status.menuUrl);
      setFeedback({ type: 'ok', text: 'Link do cardápio copiado.' });
    } catch {
      setFeedback({ type: 'error', text: 'Não foi possível copiar. Selecione o link e copie manualmente.' });
    }
  };

  const live = Boolean(status?.enabled && status.lastPublishedAt && !status.lastError);
  const published = Boolean(status?.enabled && status.menuUrl);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 mb-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Cardápio Digital (QR na mesa)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              O cliente aponta a câmera para o QR da mesa e vê o cardápio com preços, adicionais e as promoções do momento. Atualiza
              sozinho quando você altera os produtos.
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] font-black uppercase px-2 py-1 rounded border shrink-0 ${
            status?.enabled && status.lastError
              ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/30'
              : live
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/30'
                : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          }`}
        >
          {status?.enabled && status.lastError ? 'Atenção' : live ? 'No ar' : 'Desligado'}
        </span>
      </div>

      {status?.enabled && status.lastError && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{status.lastError}</span>
        </div>
      )}

      {published && status?.menuUrl && (
        <div className="flex flex-col sm:flex-row gap-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4">
          {qrPreview && (
            <div
              className="w-28 h-28 shrink-0 self-center rounded-xl bg-white p-2 [&_svg]:w-full [&_svg]:h-full"
              dangerouslySetInnerHTML={{ __html: qrPreview }}
            />
          )}
          <div className="min-w-0 flex-1 space-y-2 text-xs">
            <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">Link do cardápio</p>
            <p className="font-mono font-bold text-slate-900 dark:text-white break-all select-all">{status.menuUrl}</p>
            <p className="text-slate-500 dark:text-slate-400">
              Última publicação: <span className="font-mono font-bold">{formatDateTime(status.lastPublishedAt)}</span>. No QR de cada mesa
              o link leva o número dela (ex.: <span className="font-mono">?mesa=5</span>).
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={openMenu}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir cardápio
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar link
              </button>
              <button
                type="button"
                onClick={handleQrSheet}
                disabled={busy !== null}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition disabled:opacity-50 cursor-pointer"
              >
                {busy === 'qr' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                QR Codes das mesas (PDF)
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Switch checked={enabled} onChange={() => setEnabled((v) => !v)} label="Publicar o cardápio na internet" />

        <button
          type="button"
          onClick={() => setShowItems(true)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-left transition cursor-pointer"
        >
          <span className="flex items-center gap-3">
            <ListChecks className="w-5 h-5 text-amber-500 shrink-0" />
            <span>
              <span className="block text-sm font-bold text-slate-900 dark:text-white">Escolher itens, fotos e descrições</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                Marque o que aparece no cardápio e adicione foto e descrição a cada produto.
              </span>
            </span>
          </span>
          <span className="text-xs font-black text-amber-700 dark:text-amber-400 shrink-0">Abrir</span>
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">Nome no cardápio</span>
            <input
              type="text"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={status?.defaultTitle || 'Nome do bar'}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">Recado no topo (opcional)</span>
            <input
              type="text"
              value={messageText}
              maxLength={300}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Ex.: Wi-Fi BarDoZe · senha 12345678"
              className={INPUT_CLASS}
            />
          </label>
        </div>

        {categories.length > 0 && (
          <div className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">
              Categorias no cardápio <span className="font-medium text-slate-400">(clique para esconder ou mostrar)</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const hidden = hiddenIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    aria-pressed={!hidden}
                    className={`px-3 py-1.5 rounded-full border text-xs font-bold transition cursor-pointer ${
                      hidden
                        ? 'bg-transparent text-slate-400 border-slate-300 dark:border-slate-700 line-through'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Switch
          checked={ignoreStock}
          onChange={() => setIgnoreStock((v) => !v)}
          label='Ignorar o estoque (nada aparece como "Esgotado"; use se o estoque não é controlado)'
        />

        {!ignoreStock && (
          <Switch
            checked={hideSoldOut}
            onChange={() => setHideSoldOut((v) => !v)}
            label='Esconder produtos sem estoque (desligado: aparecem como "Esgotado")'
          />
        )}
        <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-1">Itens da cozinha nunca aparecem como esgotados.</p>

        <details className="group">
          <summary className="text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer select-none">Avançado</summary>
          <label className="block space-y-1 mt-2">
            <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">Endereço do site do cardápio</span>
            <input
              type="text"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder={status?.siteUrl || 'https://cardapio-barerp.netlify.app'}
              className={`${INPUT_CLASS} font-mono text-xs`}
            />
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              Deixe vazio para usar o site padrão. Ao trocar, os QR Codes impressos precisam ser refeitos.
            </span>
          </label>
        </details>
      </div>

      {feedback && (
        <div
          className={`flex items-start gap-2 text-xs font-semibold ${
            feedback.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {feedback.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-end gap-2">
        {status?.enabled && (
          <button
            type="button"
            onClick={handlePublish}
            disabled={busy !== null}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-black transition disabled:opacity-50 cursor-pointer"
          >
            {busy === 'publish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {busy === 'publish' ? 'Publicando...' : 'Publicar agora'}
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition disabled:opacity-50 cursor-pointer shadow-md shadow-amber-500/20"
        >
          {busy === 'save' && <Loader2 className="w-4 h-4 animate-spin" />}
          {busy === 'save' ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {showItems && <DigitalMenuItemsModal onClose={() => setShowItems(false)} />}
    </div>
  );
};
