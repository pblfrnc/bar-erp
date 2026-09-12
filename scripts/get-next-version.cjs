const fs = require('fs');
const path = require('path');
const https = require('https');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
let localVersion = '1.7.0';

try {
  const localPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  localVersion = localPkg.version || '1.7.0';
} catch (e) {}

function parseSemver(v) {
  const clean = (v || '0.0.0').replace(/^v/i, '').trim();
  const parts = clean.split('.').map(n => parseInt(n, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function compareSemver(v1, v2) {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

function bumpVersion(v) {
  const [maj, min, pat] = parseSemver(v);
  // Se for da linha 1.6.x legada (ex: 1.6.9), transiciona diretamente para 1.7.0
  if (maj === 1 && min === 6 && pat >= 9) {
    return '1.7.0';
  }
  return `${maj}.${min}.${pat + 1}`;
}

function fetchWithRedirects(url, maxRedirects = 5) {
  return new Promise((resolve) => {
    if (maxRedirects <= 0) return resolve(null);
    https.get(url, { headers: { 'User-Agent': 'BarERP-Version-Fetcher' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchWithRedirects(res.headers.location, maxRedirects - 1));
      }
      if (res.statusCode !== 200) return resolve(null);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(null));
  });
}

async function fetchRemoteVersion() {
  try {
    const raw = await fetchWithRedirects('https://github.com/pblfrnc/bar-erp/releases/download/latest/version.json');
    if (!raw) return null;
    const j = JSON.parse(raw);
    return j.version || null;
  } catch (e) {
    return null;
  }
}

async function main() {
  const remoteVersion = await fetchRemoteVersion();
  console.log(`[VersionCheck] Versão remota no GitHub: ${remoteVersion || 'Nenhuma/Indisponível'}`);
  console.log(`[VersionCheck] Versão local no repositório: ${localVersion}`);

  let nextVersion = localVersion;

  if (remoteVersion) {
    // Se a versão remota no GitHub for maior ou igual à do repositório,
    // incrementamos a versão remota para garantir que cada release seja estritamente superior
    if (compareSemver(remoteVersion, localVersion) >= 0) {
      nextVersion = bumpVersion(remoteVersion);
    } else {
      nextVersion = localVersion;
    }
  } else {
    // Fallback: se não conseguiu conectar ao GitHub e a versão local ainda for 1.6.9, promove para 1.7.0
    if (compareSemver('1.6.9', localVersion) >= 0) {
      nextVersion = '1.7.0';
    } else {
      nextVersion = localVersion;
    }
  }

  console.log(`[VersionCheck] >>> Próxima versão calculada: ${nextVersion} <<<`);

  // Se estiver executando dentro do GitHub Actions runner
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${nextVersion}\n`);
    console.log(`[VersionCheck] Escrito em GITHUB_OUTPUT: version=${nextVersion}`);
  }

  // Se solicitado aplicar nos package.json
  if (process.argv.includes('--apply')) {
    const targets = [
      path.join(rootDir, 'package.json'),
      path.join(rootDir, 'client', 'package.json'),
      path.join(rootDir, 'server', 'package.json')
    ];
    for (const file of targets) {
      if (fs.existsSync(file)) {
        try {
          const content = JSON.parse(fs.readFileSync(file, 'utf8'));
          content.version = nextVersion;
          fs.writeFileSync(file, JSON.stringify(content, null, 2) + '\n');
          console.log(`[VersionCheck] Atualizado ${path.relative(rootDir, file)} para ${nextVersion}`);
        } catch (err) {
          console.warn(`[VersionCheck] Não foi possível atualizar ${file}:`, err.message);
        }
      }
    }
  }
}

main().catch(err => {
  console.error('[VersionCheck] Erro:', err);
  const fallback = '1.7.0';
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${fallback}\n`);
  }
  process.exit(0);
});
