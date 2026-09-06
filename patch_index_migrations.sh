sed -i '' -e '/import { prisma } from '"'"'.\/prisma.js'"'"';/a\
import { runRuntimeMigrations } from '"'"'.\/runMigrations.js'"'"';\
' server/src/index.ts

sed -i '' -e '/const startServer = async () => {/a\
  // Rodar migrações de runtime no banco SQLite atual\
  await runRuntimeMigrations(prisma);\
' server/src/index.ts
