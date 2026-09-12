const fs = require('fs');
const path = require('path');

const type = process.argv[2] || 'patch';
const rootDir = path.resolve(__dirname, '..');
const files = [
  path.join(rootDir, 'package.json'),
  path.join(rootDir, 'client', 'package.json'),
  path.join(rootDir, 'server', 'package.json')
];

let current = '1.6.9';
try {
  const mainPkg = JSON.parse(fs.readFileSync(files[0], 'utf8'));
  current = mainPkg.version || '1.6.9';
} catch (e) {}

const parts = current.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
let maj = parts[0] || 1;
let min = parts[1] || 7;
let pat = parts[2] || 0;

if (type === 'major') {
  maj++;
  min = 0;
  pat = 0;
} else if (type === 'minor') {
  min++;
  pat = 0;
} else {
  // patch
  if (maj === 1 && min === 6 && pat >= 9) {
    min = 7;
    pat = 0;
  } else {
    pat++;
  }
}

const next = `${maj}.${min}.${pat}`;

for (const f of files) {
  if (fs.existsSync(f)) {
    try {
      const json = JSON.parse(fs.readFileSync(f, 'utf8'));
      json.version = next;
      fs.writeFileSync(f, JSON.stringify(json, null, 2) + '\n');
      console.log(`[Bump] Atualizado ${path.relative(rootDir, f)} para v${next}`);
    } catch (e) {
      console.warn(`[Bump] Erro ao atualizar ${f}:`, e.message);
    }
  }
}

console.log(`\n✅ Versão do projeto atualizada com sucesso: v${current} -> v${next}`);
