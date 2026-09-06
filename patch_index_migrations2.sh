sed -i '' -e '1i\
import { prisma } from '"'"'.\/prisma.js'"'"';\
import { runRuntimeMigrations } from '"'"'.\/runMigrations.js'"'"';\
' server/src/index.ts

sed -i '' -e '/httpServer.listen(PORT/i\
  await runRuntimeMigrations(prisma);\
' server/src/index.ts
