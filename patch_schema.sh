sed -i '' -e '/model Product {/a\
  ncm         String?\
  cfop        String?\
' server/prisma/schema.prisma

cat << 'INNER_EOF' >> server/prisma/schema.prisma

model FiscalSettings {
  id          String   @id @default("default")
  apiToken    String?
  cnpj        String?
  ie          String?
  crt         String?
  cscId       String?
  cscSecret   String?
  addressInfo String?
  updatedAt   DateTime @updatedAt
}
INNER_EOF
