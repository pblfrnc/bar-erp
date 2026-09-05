import { build } from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, '..');
const outDir = join(serverRoot, 'dist');
const prismaClientDir = join(serverRoot, 'node_modules', '.prisma', 'client');
const prismaOutDir = join(outDir, '.prisma', 'client');

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
  copyFileSync(join(prismaClientDir, file), join(prismaOutDir, file));
  console.log('Copiado:', file);
}
console.log('\nBuild do servidor concluido!\n');
