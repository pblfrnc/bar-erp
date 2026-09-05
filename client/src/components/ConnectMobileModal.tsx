import React, { useState, useEffect } from 'react';
import { QrCodeSvg } from '../utils/qr';
import {
  Smartphone,
  Wifi,
  Copy,
  Check,
  X,
  ShieldAlert,
  HelpCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface ConnectMobileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectMobileModal: React.FC<ConnectMobileModalProps> = ({ isOpen, onClose }) => {
  const [ips, setIps] = useState<string[]>([]);
  const [port, setPort] = useState<number>(3001);
  const [loading, setLoading] = useState(true);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const fetchNetworkInfo = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setIps(data.ips || []);
        if (data.port) setPort(data.port);
      }
    } catch (err) {
      console.error('Erro ao buscar IP da rede:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNetworkInfo();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const primaryIp = ips.length > 0 ? ips[0] : window.location.hostname || '192.168.0.x';
  const serverUrl = `http://${primaryIp}:${port}`;
  const firewallCmd = `netsh advfirewall firewall add rule name="BarERP" dir=in action=allow protocol=TCP localport=${port}`;

  const handleCopy = (text: string, isCommand = false) => {
    navigator.clipboard.writeText(text);
    if (isCommand) {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } else {
      setCopiedIp(text);
      setTimeout(() => setCopiedIp(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto transition-colors duration-150">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Conectar App Android / Celular
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Endereço IP do computador na rede local Wi-Fi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code & IP em Destaque */}
        <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <QrCodeSvg value={serverUrl} size={150} />

          <div className="flex-1 text-center sm:text-left space-y-2 w-full">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <Wifi className="w-4 h-4" />
              <span>IP DO COMPUTADOR DO CAIXA:</span>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-2xl font-mono font-black text-slate-900 dark:text-white tracking-tight block">
                {primaryIp}
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 block mt-0.5">
                Porta: {port}
              </span>
            </div>

            <button
              onClick={() => handleCopy(primaryIp)}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
            >
              {copiedIp ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedIp ? 'IP Copiado!' : 'Copiar Apenas o IP'}</span>
            </button>
          </div>
        </div>

        {/* Passo a Passo Simples */}
        <div className="space-y-2 text-xs">
          <span className="font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
            Como conectar no celular do garçom:
          </span>
          <div className="space-y-1.5 text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <span>
                Conecte o celular na <strong>mesma rede Wi-Fi</strong> deste computador.
              </span>
            </div>

            <div className="flex items-start gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <span>
                Abra o app no celular. Na tela de IP, digite: <code className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono font-bold">{primaryIp}</code> e clique em <strong>Salvar e Conectar</strong>.
              </span>
            </div>

            <div className="flex items-start gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <span>
                Ou abra o navegador Chrome no celular e acesse direto: <code className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-bold">{serverUrl}</code>
              </span>
            </div>
          </div>
        </div>

        {/* Dica do Firewall do Windows */}
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-black">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>O celular não achou o computador? (Firewall do Windows)</span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
            No Windows, o Firewall pode bloquear a porta {port}. Se o celular não conectar, abra o <strong>Prompt de Comando (CMD) como Administrador</strong> e cole este comando:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 rounded-lg bg-slate-900 text-amber-300 font-mono text-[10px] break-all select-all">
              {firewallCmd}
            </code>
            <button
              onClick={() => handleCopy(firewallCmd, true)}
              className="py-1.5 px-2.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shrink-0 cursor-pointer active:scale-95"
            >
              {copiedCmd ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        {/* Botão Fechar */}
        <div className="pt-1 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
