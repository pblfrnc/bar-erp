import { build } from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, '..');
const outDir = join(serverRoot, 'dist');
const prismaClientDir = join(serverRoot, 'node_modules', '.prisma', 'client');
const prismaOutDir = join(outDir, 'prisma-engine');

await build({
  entryPoints: [join(serverRoot, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
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
