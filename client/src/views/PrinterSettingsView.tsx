import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Printer, 
  Settings2, 
  Check, 
  RefreshCw, 
  Sliders, 
  Maximize2, 
  Scissors, 
  QrCode, 
  ZoomIn, 
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { PrinterSettings } from '../types';

interface DetectedPrinter {
  name: string;
  displayName?: string;
  description?: string;
  isDefault?: boolean;
  status?: number;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  cashierPrinter: '',
  kitchenPrinter: '',
  paperWidth: 80,
  marginTop: 2,
  marginBottom: 12,
  marginLeft: 1,
  marginRight: 1,
  fontScale: 100,
  qrSize: 100,
  autoCut: true,
  silentPrint: true,
  copies: 1,
  extraFeedLines: 3,
  printLogo: true
};

export const PrinterSettingsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_SETTINGS);
  const [availablePrinters, setAvailablePrinters] = useState<DetectedPrinter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testPrinting, setTestPrinting] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  // Carregar configurações salvas e detectar impressoras do sistema
  const loadPrintersAndSettings = async () => {
    setLoading(true);
    try {
      const isElec = Boolean((window as any).electronAPI?.isElectron);
      setIsElectron(isElec);

      // 1. Detectar impressoras físicas do Windows/Mac
      if (isElec && (window as any).electronAPI?.getPrinters) {
        try {
          const printers: DetectedPrinter[] = await (window as any).electronAPI.getPrinters();
          setAvailablePrinters(printers || []);
        } catch (e) {
          console.warn('Erro ao listar impressoras do Electron:', e);
        }
      }

      // 2. Carregar configurações salvas do servidor
      let saved: PrinterSettings | null = null;
      try {
        saved = await api.getPrinterSettings();
      } catch (err) {
        console.warn('Servidor offline ou sem settings no backend, tentando local...', err);
      }

      // Fallback: tentar Electron local ou localStorage
      if (!saved && isElec && (window as any).electronAPI?.getSavedPrinterSettings) {
        try {
          saved = await (window as any).electronAPI.getSavedPrinterSettings();
        } catch (e) {}
      }

      if (!saved) {
        try {
          const localStr = localStorage.getItem('bar_erp_printer_settings');
          if (localStr) saved = JSON.parse(localStr);
        } catch (e) {}
      }

      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...saved });
      }
    } catch (err) {
      console.error('Erro geral ao carregar configurações de impressora:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrintersAndSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      // 1. Salvar no localStorage do navegador para resposta instantânea
      localStorage.setItem('bar_erp_printer_settings', JSON.stringify(settings));

      // 2. Atualizar variáveis CSS globais no :root para comandas da tela
      document.documentElement.style.setProperty('--printer-paper-width', `${settings.paperWidth}mm`);
      document.documentElement.style.setProperty('--printer-margin-left', `${settings.marginLeft}mm`);
      document.documentElement.style.setProperty('--printer-margin-right', `${settings.marginRight}mm`);

      // 3. Salvar no Backend
      try {
        await api.savePrinterSettings(settings);
      } catch (e) {
        console.warn('Falha ao salvar no backend, mas salvo localmente:', e);
      }

      // 4. Salvar nativamente no Electron
      if ((window as any).electronAPI?.savePrinterSettings) {
        try {
          await (window as any).electronAPI.savePrinterSettings(settings);
        } catch (e) {}
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar as configurações recomendadas padrão (80mm, margens zeradas e QR Code 100px)?')) {
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const handlePrintTestTicket = () => {
    setTestPrinting(true);
    try {
      if ((window as any).electronAPI?.printTestTicket) {
        (window as any).electronAPI.printTestTicket(settings);
        setTimeout(() => setTestPrinting(false), 1500);
      } else {
        // Fallback no navegador
        alert('Disparando impressão de teste no navegador. Selecione sua impressora térmica no diálogo.');
        window.print();
        setTestPrinting(false);
      }
    } catch (e) {
      console.error(e);
      setTestPrinting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pt-4 pb-20 px-2 sm:px-4">
      {/* Barra de Navegação */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack} 
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition font-bold text-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Retaguarda
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Padrões
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-md cursor-pointer ${
              saveSuccess 
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20' 
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-95'
            }`}
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Salvo com Sucesso!
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Salvar Configurações
              </>
            )}
          </button>
        </div>
      </div>

      {/* Cabeçalho do Módulo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-sm dark:shadow-2xl">
        <div className="absolute top-0 right-0 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <Printer className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  Configurações de Impressoras Térmicas
                </h1>
                {isElectron ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                    Electron Conectado
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30">
                    Modo Navegador Web
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Calibre a largura da bobina (80mm / 58mm), margens milimétricas e o tamanho do QR Code da NFC-e para qualquer impressora térmica (Epson, Bematech, Elgin, POS-80).
              </p>
            </div>
          </div>

          <button
            onClick={handlePrintTestTicket}
            disabled={testPrinting}
            className="px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer shrink-0"
          >
            <Printer className={`w-4 h-4 ${testPrinting ? 'animate-bounce' : ''}`} />
            {testPrinting ? 'Imprimindo Teste...' : 'Imprimir Página de Teste'}
          </button>
        </div>
      </div>

      {/* Grid Principal: Configurações + Simulador da Bobina */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Painel de Configurações (8 colunas) */}
        <div className="lg:col-span-7 space-y-6">

          {/* 1. Seleção de Impressora Física do Sistema Operacional */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Settings2 className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  1. Impressora Física Conectada
                </h3>
              </div>

              {isElectron && (
                <button
                  onClick={loadPrintersAndSettings}
                  title="Atualizar lista de impressoras conectadas"
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase">
                  Impressora do Caixa / Balcão (NFC-e & Comandas)
                </label>
                {availablePrinters.length > 0 ? (
                  <select
                    value={settings.cashierPrinter}
                    onChange={e => setSettings({ ...settings, cashierPrinter: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm font-bold outline-none focus:border-amber-500 transition"
                  >
                    <option value="">(Padrão do Sistema Operacional)</option>
                    {availablePrinters.map(p => (
                      <option key={p.name} value={p.name}>
                        {p.displayName || p.name} {p.isDefault ? '⭐ [Padrão]' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Nome da impressora no Windows (ex: POS-80 ou Epson)"
                    value={settings.cashierPrinter}
                    onChange={e => setSettings({ ...settings, cashierPrinter: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm font-mono outline-none focus:border-amber-500 transition"
                  />
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  {availablePrinters.length > 0 
                    ? `${availablePrinters.length} impressoras detectadas no computador.` 
                    : 'Deixe vazio para usar a impressora padrão configurada no Windows.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase">
                  Impressora da Cozinha / Produção (Tickets KDS)
                </label>
                {availablePrinters.length > 0 ? (
                  <select
                    value={settings.kitchenPrinter}
                    onChange={e => setSettings({ ...settings, kitchenPrinter: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm font-bold outline-none focus:border-amber-500 transition"
                  >
                    <option value="">(Mesma do Caixa / Balcão)</option>
                    {availablePrinters.map(p => (
                      <option key={p.name} value={p.name}>
                        {p.displayName || p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Nome da impressora da cozinha (opcional)"
                    value={settings.kitchenPrinter}
                    onChange={e => setSettings({ ...settings, kitchenPrinter: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm font-mono outline-none focus:border-amber-500 transition"
                  />
                )}
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                <span className="text-base leading-none">📄</span>
                <div>
                  <strong className="block font-black text-blue-800 dark:text-blue-300 uppercase tracking-wide text-[11px] mb-0.5">
                    Impressão de NF-e (Modelo 55 - Folha A4) Diferenciada
                  </strong>
                  A NF-e para fornecedores/empresas <strong>não é enviada para a impressora térmica do caixa</strong>. Ao imprimir a NF-e, o Bar ERP <strong>abre a janela de impressão do sistema (Windows / macOS)</strong> para você escolher sua impressora A4 comum (Laser / Jato de Tinta) ou Salvar em PDF.
                </div>
              </div>
            </div>
          </div>

          {/* 2. Tamanho do Papel / Bobina Térmica */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <Maximize2 className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                2. Tamanho da Bobina de Papel
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setSettings({ 
                  ...settings, 
                  paperWidth: 80, 
                  qrSize: 100, 
                  marginLeft: 1, 
                  marginRight: 1 
                })}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer relative overflow-hidden ${
                  settings.paperWidth === 80
                    ? 'bg-amber-500/10 border-amber-500 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                }`}
              >
                {settings.paperWidth === 80 && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  </div>
                )}
                <div className="text-base font-black">Bobina 80mm</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Padrão 3 Polegadas • Mais comum em bares, restaurantes e caixas.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSettings({ 
                  ...settings, 
                  paperWidth: 58, 
                  qrSize: 85, 
                  marginLeft: 1, 
                  marginRight: 1 
                })}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer relative overflow-hidden ${
                  settings.paperWidth === 58
                    ? 'bg-amber-500/10 border-amber-500 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                }`}
              >
                {settings.paperWidth === 58 && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  </div>
                )}
                <div className="text-base font-black">Bobina 58mm</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Padrão 2 Polegadas • Mini impressoras portáteis ou compactas.
                </div>
              </button>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                Largura Personalizada (mm):
              </label>
              <input
                type="number"
                min="40"
                max="120"
                value={settings.paperWidth}
                onChange={e => setSettings({ ...settings, paperWidth: Number(e.target.value) || 80 })}
                className="w-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white font-mono text-sm font-bold text-center outline-none focus:border-amber-500"
              />
              <span className="text-xs text-slate-500">milímetros de largura física</span>
            </div>
          </div>

          {/* 3. Margens Milimétricas & Calibração de Borda */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  3. Margens & Alinhamento Milimétrico
                </h3>
              </div>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                Ajuste fino de bordas
              </span>
            </div>

            <div className="space-y-4">
              {/* Margem Esquerda */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Margem Esquerda</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">{settings.marginLeft} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  value={settings.marginLeft}
                  onChange={e => setSettings({ ...settings, marginLeft: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">Aumente se o texto encostar muito na esquerda ou se a impressora comer letras no início.</p>
              </div>

              {/* Margem Direita */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Margem Direita</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">{settings.marginRight} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  value={settings.marginRight}
                  onChange={e => setSettings({ ...settings, marginRight: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">Aumente se a margem direita estiver cortando o final dos preços.</p>
              </div>

              {/* Margem Superior */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Margem Superior (Topo)</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">{settings.marginTop} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={settings.marginTop}
                  onChange={e => setSettings({ ...settings, marginTop: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Margem Inferior (Espaço para Guilhotina) */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Margem Inferior (Segurança da Guilhotina/Picote)</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">{settings.marginBottom} mm</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="30"
                  step="1"
                  value={settings.marginBottom}
                  onChange={e => setSettings({ ...settings, marginBottom: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">Espaço extra no rodapé para a lâmina da guilhotina não cortar o QR Code ou protocolo da SEFAZ.</p>
              </div>
            </div>
          </div>

          {/* 4. Escala da Fonte & Tamanho do QR Code */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <QrCode className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                4. QR Code da SEFAZ & Escala de Texto
              </h3>
            </div>

            <div className="space-y-6">
              {/* Controle de QR Code */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">
                  <span>Tamanho do QR Code da NFC-e:</span>
                  <span className="font-mono text-amber-500 font-black">
                    {settings.qrSize}px <span className="text-[10px] text-slate-500 font-normal">({Math.round((settings.qrSize / 96) * 25.4)}mm aprox.)</span>
                  </span>
                </div>

                {/* Slider contínuo de 60px a 160px */}
                <input
                  type="range"
                  min="60"
                  max="160"
                  step="5"
                  value={settings.qrSize}
                  onChange={e => setSettings({ ...settings, qrSize: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer mb-3"
                />

                {/* Botões de atalho rápido */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { label: 'Micro', size: 75, desc: '20mm (Mín. SEFAZ)' },
                    { label: 'Pequeno', size: 85, desc: '22mm' },
                    { label: 'Padrão', size: 100, desc: '26mm (Ideal)' },
                    { label: 'Médio', size: 115, desc: '30mm' },
                    { label: 'Grande', size: 130, desc: '35mm' }
                  ].map(opt => (
                    <button
                      key={opt.size}
                      type="button"
                      onClick={() => setSettings({ ...settings, qrSize: opt.size })}
                      className={`py-2 px-1 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                        settings.qrSize === opt.size
                          ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400 font-black shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                      }`}
                    >
                      <div>{opt.label}</div>
                      <div className="text-[10px] opacity-75 font-normal mt-0.5">{opt.size}px</div>
                      <div className="text-[9px] text-amber-600/80 dark:text-amber-400/80">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  💡 A SEFAZ recomenda QR Code entre 20mm e 28mm (~75px a 105px). Tamanhos menores economizam papel e mantêm a leitura instantânea pela câmera do celular.
                </p>
              </div>

              {/* Controle de Escala do Texto */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase">
                  <span>Escala do Texto da Impressão:</span>
                  <span className="font-mono text-amber-500 font-black">{settings.fontScale}%</span>
                </div>

                <input
                  type="range"
                  min="70"
                  max="115"
                  step="5"
                  value={settings.fontScale}
                  onChange={e => setSettings({ ...settings, fontScale: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer mb-3"
                />

                <div className="grid grid-cols-6 gap-1.5">
                  {[75, 80, 85, 90, 100, 110].map(scale => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => setSettings({ ...settings, fontScale: scale })}
                      className={`py-2 px-1 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                        settings.fontScale === scale
                          ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400 font-black'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                      }`}
                    >
                      {scale}%
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  💡 A escala em <strong>85%</strong> ou <strong>90%</strong> é excelente para impressoras de 80mm com margens estreitas, evitando quebras de linhas de produtos.
                </p>
              </div>
            </div>
          </div>

          {/* 5. Opções de Guilhotina & Comportamento */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Scissors className="w-5 h-5 text-amber-500" />
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white">
                    Acionamento de Guilhotina (Auto-Cut)
                  </h4>
                  <p className="text-[11px] text-slate-500">Comando de corte de papel automático ao terminar o cupom.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoCut}
                onChange={e => setSettings({ ...settings, autoCut: e.target.checked })}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white">
                    Impressão Silenciosa Direta (1 Clique)
                  </h4>
                  <p className="text-[11px] text-slate-500">Imprime direto na impressora sem abrir diálogo do Windows.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.silentPrint}
                onChange={e => setSettings({ ...settings, silentPrint: e.target.checked })}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </div>
          </div>

        </div>

        {/* Simulador da Bobina Térmica (4 colunas) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-500" />
                Simulador da Bobina em Tempo Real
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">
                {settings.paperWidth}mm • Margens: E:{settings.marginLeft} D:{settings.marginRight}
              </span>
            </div>

            {/* Bobina Virtual Térmica */}
            <div className="bg-slate-200 dark:bg-slate-950/80 p-4 rounded-3xl border border-slate-300 dark:border-slate-800 flex justify-center shadow-inner overflow-hidden">
              <div 
                style={{
                  width: `${Math.min(360, settings.paperWidth * 4)}px`,
                  paddingLeft: `${settings.marginLeft * 3}px`,
                  paddingRight: `${settings.marginRight * 3}px`,
                  paddingTop: `${settings.marginTop * 3}px`,
                  paddingBottom: `${settings.marginBottom * 3}px`,
                  transform: `scale(${settings.fontScale / 100})`,
                  transformOrigin: 'top center'
                }}
                className="bg-white text-black font-mono text-[10px] leading-tight rounded-sm shadow-xl border-x border-slate-300 relative transition-all duration-300 select-none"
              >
                {/* Linha de Corte Topo */}
                <div className="border-b border-dashed border-slate-400 pb-2 mb-2 text-center">
                  <div className="font-bold text-xs">J. M. A. DE SOUZA COMERCIO</div>
                  <div className="text-[9px] text-slate-700">CNPJ: 36.275.163/0001-24</div>
                  <div className="text-[9px] text-slate-700">TAILÂNDIA - PA</div>
                  <div className="text-[11px] font-black mt-1">NFC-e Nº 000002 • SÉRIE 2</div>
                </div>

                {/* Itens */}
                <div className="border-b border-dashed border-slate-400 pb-2 mb-2">
                  <div className="flex justify-between font-bold text-[9px] mb-1">
                    <span>ITEM / DESCRIÇÃO</span>
                    <span>TOTAL</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1x CERV HEINEKEN 600ML</span>
                    <span className="font-bold">R$ 15,00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1x PORÇÃO DE FRITAS</span>
                    <span className="font-bold">R$ 25,00</span>
                  </div>
                </div>

                {/* Totais */}
                <div className="border-b border-dashed border-slate-400 pb-2 mb-2 text-[10px]">
                  <div className="flex justify-between font-black text-xs">
                    <span>VALOR TOTAL:</span>
                    <span>R$ 40,00</span>
                  </div>
                  <div className="flex justify-between text-slate-700 mt-0.5">
                    <span>Forma: DINHEIRO</span>
                    <span>R$ 40,00</span>
                  </div>
                </div>

                {/* QR Code Simulado */}
                <div className="text-center my-2">
                  <div className="text-[9px] font-bold mb-1">CONSULTE PELA SEFAZ:</div>
                  <div 
                    style={{ 
                      width: `${Math.min(220, settings.qrSize)}px`, 
                      height: `${Math.min(220, settings.qrSize)}px` 
                    }}
                    className="mx-auto bg-slate-100 border border-slate-400 flex flex-col items-center justify-center p-2 rounded-xs"
                  >
                    <QrCode className="w-full h-full text-slate-800" />
                  </div>
                  <div className="text-[8px] text-slate-500 font-mono mt-1">
                    Dimensão: {settings.qrSize}px (~{Math.round((settings.qrSize / 96) * 25.4)}mm)
                  </div>
                  <div className="text-[8px] text-slate-600 font-mono break-all">
                    Chave: 1526 0936 2751 6300 0124...
                  </div>
                </div>

                {/* Picote / Guilhotina */}
                <div className="border-t border-dashed border-red-400 pt-1 text-center text-[8px] text-red-600 font-bold">
                  ✂ Linha de corte da guilhotina (+{settings.marginBottom}mm)
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 mt-4">
              <div className="flex gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>Dica de Calibração:</strong> Se a impressão na sua impressora física estiver cortando à direita, aumente a <strong>Margem Direita</strong> para 2 ou 3 mm e certifique-se de que a bobina selecionada corresponde ao papel real (80mm ou 58mm).
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
