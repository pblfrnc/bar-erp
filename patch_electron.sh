sed -i '' -e '/const { pathToFileURL } = require('"'"'url'"'"');/a\
const { setupDailyBackup } = require('"'"'./backup.js'"'"');\
' electron/main.cjs

sed -i '' -e '/process.env.DATABASE_URL = `file:${dbPath}`;/a\
    // Executa o backup diário logo após definir o banco\
    setupDailyBackup(userDataPath, '"'"'bar.db'"'"');\
    // Verifica a cada 6 horas se o dia virou (caso o PC fique ligado 24/7)\
    setInterval(() => setupDailyBackup(userDataPath, '"'"'bar.db'"'"'), 6 * 60 * 60 * 1000);\
' electron/main.cjs
