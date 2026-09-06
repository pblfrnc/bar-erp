sed -i '' -e '/process.env.DATABASE_URL = `file:${normalizedDbPath}`;/a\
    // Executa o backup diário logo após definir o banco\
    setupDailyBackup(userDataPath, '"'"'bar.db'"'"');\
    // Verifica a cada 6 horas se o dia virou (caso o PC fique ligado 24/7)\
    setInterval(() => setupDailyBackup(userDataPath, '"'"'bar.db'"'"'), 6 * 60 * 60 * 1000);\
' electron/main.cjs
