const fs = require('fs');
let code = fs.readFileSync('client/src/views/SettingsView.tsx', 'utf8');

code = code.replace(
  "import { Settings, Users, Smartphone, Printer, ChevronRight, ShieldCheck } from 'lucide-react';",
  "import { Settings, Users, Smartphone, Printer, ChevronRight, ShieldCheck, MonitorSmartphone, Wifi } from 'lucide-react';\nimport { socket } from '../services/socket';"
);

const stateAndEffect = `
  const [backupInfo, setBackupInfo] = useState<any>(null);
  const [connectedDevices, setConnectedDevices] = useState<any[]>([]);

  useEffect(() => {
    api.getBackupStatus().then(setBackupInfo).catch(() => {});

    // Buscar dispositivos iniciais
    fetch('/api/network/devices')
      .then(r => r.json())
      .then(setConnectedDevices)
      .catch(() => {});

    // Escutar eventos ao vivo
    const handleDevicesUpdated = (devices: any[]) => {
      setConnectedDevices(devices);
    };
    
    socket.on('devices_updated', handleDevicesUpdated);
    
    return () => {
      socket.off('devices_updated', handleDevicesUpdated);
    };
  }, []);
`;

code = code.replace(/const \[backupInfo, setBackupInfo\] = useState<any>\(null\);\s*useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/, stateAndEffect.trim());

const devicesSection = `
      {/* Dispositivos Conectados */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <MonitorSmartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Dispositivos Conectados ({connectedDevices.length})</h3>
            <p className="text-xs text-slate-400">Tempo real dos celulares e painéis KDS conectados na rede.</p>
          </div>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {connectedDevices.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              Nenhum dispositivo móvel conectado no momento.
            </div>
          ) : (
            connectedDevices.map((dev, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 gap-3">
                <div className="flex items-center gap-3">
                  <div className={\`w-2 h-2 rounded-full animate-pulse \${dev.clientType === 'GARCOM_MOBILE' ? 'bg-amber-400' : dev.clientType === 'COZINHA_KDS' ? 'bg-orange-500' : 'bg-emerald-400'}\`} />
                  <div>
                    <div className="text-sm font-bold text-slate-200">
                      {dev.clientType === 'GARCOM_MOBILE' ? '📱 App Garçom' : dev.clientType === 'COZINHA_KDS' ? '📺 Tela Cozinha (KDS)' : '💻 ' + dev.clientType}
                      {dev.waiterName && <span className="text-amber-400 ml-1">({dev.waiterName})</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 max-w-[200px] truncate" title={dev.userAgent}>
                      {dev.userAgent}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <Wifi className="w-3.5 h-3.5 text-cyan-500" />
                  {dev.ip}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
`;

code = code.replace(/<\/div>\s*<\/div>\s*\);\s*\};\s*$/, devicesSection);

fs.writeFileSync('client/src/views/SettingsView.tsx', code);
