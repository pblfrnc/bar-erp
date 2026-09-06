const fs = require('fs');
let code = fs.readFileSync('server/src/index.ts', 'utf8');

const newFunc = `function getLocalIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  
  for (const name of Object.keys(interfaces)) {
    const isVirtual = name.toLowerCase().includes('virtual') || name.toLowerCase().includes('vmware') || name.toLowerCase().includes('vethernet') || name.toLowerCase().includes('wsl') || name.toLowerCase().includes('tailscale') || name.toLowerCase().includes('hamachi');
    if (isVirtual) continue;
    
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        // Priorizar IPs comuns de rede local
        if (net.address.startsWith('192.168.')) {
          ips.unshift(net.address); // Joga pro topo
        } else {
          ips.push(net.address);
        }
      }
    }
  }
  return ips;
}`;

code = code.replace(/function getLocalIps\(\): string\[\] \{[\s\S]*?return ips;\n\}/, newFunc);
fs.writeFileSync('server/src/index.ts', code);
