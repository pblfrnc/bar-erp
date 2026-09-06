import { build } from 'esbuild';
import fs, { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, '..');
const outDir = join(serverRoot, 'dist');
const prismaClientDir = join(serverRoot, 'node_modules', '.prisma', 'client');
const prismaOutDir = join(outDir, 'prisma-engine');

// 1. Build CommonJS bundle (index.cjs) para máxima compatibilidade no Electron Main
await build({
  entryPoints: [join(serverRoot, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: join(outDir, 'index.cjs'),
  external: ['*.node'],
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});

// 2. Build ESM bundle (index.js) com banner de createRequire para evitar 'Dynamic require is not supported'
await build({
  entryPoints: [join(serverRoot, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
  },
  outfile: join(outDir, 'index.js'),
  external: ['*.node'],
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});

if (!existsSync(prismaClientDir)) {
  console.error('❌ .prisma/client nao encontrado:', prismaClientDir);
  process.exit(1);
}

mkdirSync(prismaOutDir, { recursive: true });
for (const file of readdirSync(prismaClientDir)) {
  if (!fs.statSync(join(prismaClientDir, file)).isFile()) continue;
  const src = join(prismaClientDir, file);
  copyFileSync(src, join(prismaOutDir, file));
  // Copia também na raiz do dist para máxima compatibilidade
  if (file.endsWith('.node') || file.endsWith('.prisma')) {
    copyFileSync(src, join(outDir, file));
  }
  console.log('Copiado:', file);
}
console.log('\nBuild do servidor concluido com sucesso!\n');
process.exit(0);
