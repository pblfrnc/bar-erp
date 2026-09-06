sed -i '' -e 's/await runRuntimeMigrations(prisma);//' server/src/index.ts

sed -i '' -e 's/httpServer.listen(PORT, '"'"'0.0.0.0'"'"', () => {/const start = async () => {\
  await runRuntimeMigrations(prisma);\
  httpServer.listen(PORT, '"'"'0.0.0.0'"'"', () => {/g' server/src/index.ts

sed -i '' -e 's/  console.log('"'"'======================================================\\n'"'"');\
});/  console.log('"'"'======================================================\\n'"'"');\
  });\
};\
start();/g' server/src/index.ts
