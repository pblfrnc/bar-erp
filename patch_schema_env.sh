sed -i '' -e '/model FiscalSettings {/a\
  environment String? @default("homologacao")\
' server/prisma/schema.prisma
