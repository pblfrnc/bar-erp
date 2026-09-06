sed -i '' -e '/model FiscalSettings {/a\
  cep         String?\
  logradouro  String?\
  numero      String?\
  bairro      String?\
  municipio   String?\
  uf          String?\
' server/prisma/schema.prisma
