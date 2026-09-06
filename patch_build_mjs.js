const fs = require('fs');
let code = fs.readFileSync('server/scripts/build.mjs', 'utf8');

code = code.replace(
  "for (const file of readdirSync(prismaClientDir)) {",
  "for (const file of readdirSync(prismaClientDir)) {\n  if (!fs.statSync(join(prismaClientDir, file)).isFile()) continue;"
);

code = code.replace(
  "import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';",
  "import fs, { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';"
);

fs.writeFileSync('server/scripts/build.mjs', code);
