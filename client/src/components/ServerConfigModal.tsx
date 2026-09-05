import React, { useState } from 'react';
import { getServerBaseUrl, setServerBaseUrl } from '../services/socket';
import {
  Wifi,
  Server,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  HelpCircle,
  Radio
} from 'lucide-react';

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  isOpen,
  onClose,
  isConnected
}) => {
  const currentUrl = getServerBaseUrl();
  const [inputUrl, setInputUrl] = useState(currentUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    serverIps?: string[];
  } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<string>('');

  if (!isOpen) return null;

  // Formata o endereço digitado para uma URL válida com porta 3001
  const normalizeUrl = (raw: string): string => {
    let trimmed = raw.trim().replace(/\/$/, '');
    if (!trimmed) return 'http://localhost:3001';
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      trimmed = `http://${trimmed}`;
    }
    // Se não tiver porta especificada, adiciona :3001 por padrão
    const hasPort = /:\d+$/.test(trimmed);
    if (!hasPort) {
      trimmed = `${trimmed}:3001`;
    }
    return trimmed;
  };

  const handleTestConnection = async (targetUrl?: string) => {
    const urlToTest = normalizeUrl(targetUrl || inputUrl);
    setTesting(true);
    setTestResult(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const startTime = Date.now();
      const res = await fetch(`${urlToTest}/api/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestResult({
          success: true,
          message: `Conectado com sucesso! Resposta em ${latency}ms.`,
          serverIps: data.ips
        });
      } else {
        setTestResult({
          success: false,
          message: `Servidor respondeu com status ${res.status}.`
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Não foi possível alcançar o servidor. Verifique o IP e o Wi-Fi.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const finalUrl = normalizeUrl(inputUrl);
    setServerBaseUrl(finalUrl);
  };

  const handleResetToDefault = () => {
    localStorage.removeItem('bar_server_url');
    window.location.reload();
  };

  // Varredura automática inteligente de IPs comuns da rede local
  const handleAutoDiscover = async () => {
    setScanning(true);
    setScanProgress('Iniciando busca do servidor na rede local...');
    setTestResult(null);

    // Identifica faixas de IP prováveis
    const baseSubnets = ['192.168.1.', '192.168.0.', '192.168.15.', '10.0.0.'];
    let foundServerUrl: string | null = null;

    for (const subnet of baseSubnets) {
      if (foundServerUrl) break;
      setScanProgress(`Verificando faixa ${subnet}x ...`);

      // Testa os IPs mais prováveis primeiro (.100 a .150, .2 a .30, .200 a .220)
      const testIps = [
        ...Array.from({ length: 30 }, (_, i) => `${subnet}${i + 2}`),
        ...Array.from({ length: 40 }, (_, i) => `${subnet}${i + 100}`),
        ...Array.from({ length: 20 }, (_, i) => `${subnet}${i + 200}`)
      ];

      // Dispara em lotes concorrentes de 8 requisições rápidas (timeout 1200ms)
      for (let i = 0; i < testIps.length; i += 8) {
        if (foundServerUrl) break;
        const batch = testIps.slice(i, i + 8);
        setScanProgress(`Verificando: ${batch[0]} até ${batch[batch.length - 1]}...`);

        const promises = batch.map(async (ip) => {
          const candidate = `http://${ip}:3001`;
          try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 1200);
            const r = await fetch(`${candidate}/api/health`, { signal: controller.signal });
            clearTimeout(tid);
            if (r.ok) return candidate;
          } catch {
            return null;
          }
          return null;
        });

        const results = await Promise.all(promises);
        const hit = results.find((r) => r !== null);
        if (hit) {
          foundServerUrl = hit;
          break;
        }
      }
    }

    setScanning(false);
    if (foundServerUrl) {
      setInputUrl(foundServerUrl);
      setTestResult({
        success: true,
        message: `Servidor encontrado automaticamente em: ${foundServerUrl}`
      });
    } else {
      setScanProgress('');
      setTestResult({
        success: false,
        message: 'Nenhum servidor encontrado na busca rápida. Digite o IP do PC do caixa manualmente abaixo.'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Conectar ao Servidor do Bar</h3>
              <p className="text-xs text-slate-400">Configuração de IP e rede local Wi-Fi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Atual */}
        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50' : 'bg-red-500'
              }`}
            />
            <div>
              <div className="text-xs font-bold text-white">
                {isConnected ? 'Conectado ao BarERP' : 'Desconectado / Procurando'}
              </div>
              <div className="text-[11px] text-slate-400 font-mono break-all">{currentUrl}</div>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isConnected ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'
            }`}
          >
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Campo de Digitação do Endereço / IP */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>Endereço IP do Computador do Caixa:</span>
            <span className="text-[10px] text-slate-500 font-normal">Porta padrão: 3001</span>
          </label>
          <div className="relative">
            <Radio className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                setTestResult(null);
              }}
              placeholder="Ex: 192.168.1.100 ou 192.168.0.50"
              className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Dica: Digite apenas o IP (ex: <code className="text-amber-300">192.168.1.50</code>). O sistema adiciona automaticamente <code className="text-amber-300">http://</code> e a porta <code className="text-amber-300">:3001</code>.
          </p>
        </div>

        {/* Ações de Busca e Teste */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleTestConnection()}
            disabled={testing || scanning}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin text-amber-400' : ''}`} />
            <span>{testing ? 'Testando...' : 'Testar Conexão'}</span>
          </button>

          <button
            onClick={handleAutoDiscover}
            disabled={scanning || testing}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition active:scale-95 disabled:opacity-50"
          >
            <Search className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Procurando...' : 'Auto-Localizar IP'}</span>
          </button>
        </div>

        {/* Feedback de Varredura / Teste */}
        {scanning && (
          <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs text-amber-300 animate-pulse text-center">
            {scanProgress}
          </div>
        )}

        {testResult && (
          <div
            className={`p-3 rounded-xl text-xs border flex items-start gap-2.5 ${
              testResult.success
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                : 'bg-red-950/40 text-red-300 border-red-800'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-bold">{testResult.message}</div>
              {testResult.serverIps && testResult.serverIps.length > 0 && (
                <div className="text-[11px] text-slate-300">
                  IPs detectados no servidor: {testResult.serverIps.join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Como descobrir o IP no PC */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs text-slate-400">
          <div className="font-bold text-slate-300 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Como ver o IP no computador do caixa:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] pl-1">
            <li>No Windows, aperte <kbd className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">Win + R</kbd>, digite <code className="text-amber-300">cmd</code> e tecle Enter.</li>
            <li>No terminal preto, digite <code className="text-amber-300 font-bold">ipconfig</code> e tecle Enter.</li>
            <li>Procure por <span className="text-slate-200 font-semibold">Endereço IPv4</span> (exemplo: <code className="text-amber-300">192.168.1.50</code>).</li>
            <li>Certifique-se de que o celular e o computador estão conectados no <strong>mesmo Wi-Fi</strong>.</li>
          </ol>
        </div>

        {/* Botões de Ação Final */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={handleResetToDefault}
            className="text-xs text-slate-500 hover:text-slate-300 underline"
          >
            Restaurar padrão (localhost)
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition active:scale-95 shadow-lg shadow-amber-500/20"
            >
              Salvar e Conectar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
