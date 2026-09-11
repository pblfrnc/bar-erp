# 🧠 MEMÓRIA E CONTEXTO ARQUITETURAL DO BAR ERP PRO
> **Data de Atualização:** 11 de Setembro de 2026  
> **Versão Oficial do Sistema:** `v1.6.9`  
> **Status:** Produção Estável  
> **Repositório:** [pblfrnc/bar-erp](https://github.com/pblfrnc/bar-erp)  
> **Branch Principal:** `main`  

---

## 1. 🏢 DADOS DO CLIENTE & ESTABELECIMENTO
- **Razão Social Oficial:** `J. M. A. DE SOUZA COMERCIO LTDA`
- **CNPJ:** `36.275.163/0001-24`
- **Inscrição Estadual (IE):** `156804433`
- **Município / UF:** `Tailândia - PA` (SEFA PA)
- **Regime Tributário:** Simples Nacional (CRT 1)
- **Nome Fantasia (Comercial):** Suportado e configurável via tela **Configurações Fiscais**. É injetado em destaque no topo do Cupom NFC-e e enviado à Focus NFe para o cabeçalho da NF-e.

### Contatos Oficiais da Software House & Suporte:
- **Desenvolvedor / Suporte:** Pablo Franco
- **WhatsApp Oficial:** `(47) 97400-2560` (`5547974002560`)
- **Chave PIX para Mensalidades & Renovações:** `68.817.608/0001-47`
- **Painel de Ativação Online (Render):** `https://bar-erp-licensas.onrender.com`

---

## 2. 🏗️ ARQUITETURA DO SISTEMA
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Backend:** Node.js, Express, Prisma ORM, SQLite (`server/prisma/dev.db`), WebSocket (ws).
- **Desktop Wrapper:** Electron com IPC seguro (`electron/main.cjs`, `electron/preload.cjs`).
- **Provedor Fiscal:** Focus NFe API v2 (Emissão de NFC-e mod 65 e NF-e mod 55).
- **CI/CD:** GitHub Actions que compila e gera o instalador `.exe` automaticamente em cada `push` na branch `main`.

---

## 3. 🖨️ ARQUITETURA DE IMPRESSÃO (NFC-e vs NF-e)

### A. NFC-e (Modelo 65 — Cupom Fiscal do Consumidor na Bobina Térmica)
- **Destino:** Impressora térmica de cupom do caixa (bobina de 80mm ou 58mm).
- **Modo:** **Silencioso e Direto** (`printPdfSilent`), sem abrir diálogos do Windows.
- **Dimensões e Calibração:**
  - Largura de Bobina: 80mm padrão (ou 58mm).
  - Margens milimétricas recomendadas: Esquerda: `1mm`, Direita: `1mm`, Topo: `2mm`, Rodapé/Guilhotina: `12mm`.
  - Escala de Fonte: **85%** (recomendada para evitar quebra de linha de produtos).
- **Controle do QR Code SEFAZ:**
  - **Problema resolvido:** O HTML da Focus NFe incluía um script `var qrcode = new QRCode(...)` de 250px com `margin = "36px"` que explodia o cupom.
  - **Solução implementada:** O backend (`fiscal.ts`) e o Electron (`main.cjs`) neutralizam o script da Focus NFe e injetam o QR Code com tamanho estrito configurado.
  - **Tamanho Padrão:** **100px** (~26mm — proporção recomendada pela SEFAZ).
  - **Opções disponíveis:** Slider de `60px` a `160px` com botões rápidos:
    - Micro: `75px` (20mm - Mínimo SEFAZ)
    - Pequeno: `85px` (22mm)
    - Padrão: `100px` (26mm - Ideal)
    - Médio: `115px` (30mm)
    - Grande: `130px` (35mm)
- **Nome Fantasia no Cupom:**
  - Se configurado, o proxy do DANFE injeta o Nome Fantasia em negrito (13px) no topo de `dados-da-empresa`, mantendo a Razão Social oficial e o CNPJ logo abaixo (100% legal perante o Manual do DANFE NFC-e da SEFAZ).

### B. NF-e (Modelo 55 — Nota Fiscal Grande em Folha A4)
- **Destino:** Impressora comum de escritório (Laser / Jato de Tinta) ou "Salvar como PDF".
- **Modo:** **100% Diferenciada — Abre a Janela do Sistema** (`printPdfDialog`).
- **Comportamento:**
  - **NÃO é enviada para a impressora térmica do caixa** (não sai comprimida em 80mm).
  - Abre uma janela visual de 1000x800 e aciona o diálogo nativo do Windows (`silent: false`), permitindo ao usuário escolher a impressora A4, número de cópias ou gerar PDF.
- **Implementação IPC:**
  - `electron/preload.cjs`: expõe `printPdfDialog` e `printPdf`.
  - `electron/main.cjs`: manipulador `print-pdf-dialog` e `print-pdf`.
  - `client/src/views/NfeReprintView.tsx`: botão "Imprimir DANFE A4 (Janela do Sistema)".
  - `client/src/views/EmitNfeView.tsx`: suporte à janela do sistema na emissão.

---

## 4. ⚖️ CONFORMIDADE FISCAL (SEFAZ & FOCUS NFe)
- **Manual de Padrões Técnicos do DANFE NFC-e (SEFAZ):**
  - O uso do **Nome Fantasia** no cabeçalho é expressamente autorizado e incentivado.
  - A regra é manter a Razão Social e CNPJ identificáveis, o que o Bar ERP cumpre integralmente.
- **Ambientes Focus NFe:**
  - Homologação: `https://homologacao.focusnfe.com.br`
  - Produção: `https://api.focusnfe.com.br`
  - Rota de validação `/api/fiscal/validate-api` checa `/v2/empresas/:cnpj` e alerta se o token for de ambiente divergente (ex: token de homologação em ambiente de produção).
- **Monitor da SEFA PA:**
  - Diagnóstico inteligente com teste de rota específica por UF (`/v2/nfce/status?uf=PA`), detecção de conexão e token Focus NFe.

---

## 5. 💾 BANCO DE DADOS & SEGURANÇA CONTRA FALHAS
- **Tabelas Principais:**
  - `FiscalSettings`: Token Focus, CNPJ, Razão Social, Nome Fantasia, IE, CRT, CSC ID, CSC Secret, Séries e Numerações (NFC-e e NF-e).
  - `PrinterSettings`: Impressora do Caixa, Impressora da Cozinha, Largura de Papel, Margens (T, B, L, R), Escala de Fonte, Tamanho do QR Code, Guilhotina, Silent Print.
- **Blindagem do Prisma ORM:**
  - As funções `getFiscalSettingsSafe` e `getPrinterSettingsSafe` utilizam `PRAGMA table_info` e `prisma.$queryRawUnsafe` para auto-migrar colunas que faltem no SQLite sem quebrar o servidor caso o Prisma Client esteja desatualizado.

---

## 6. 📁 MAPEAMENTO DE ARQUIVOS CRÍTICOS

| Arquivo | Função Principal |
| :--- | :--- |
| `server/src/routes/fiscal.ts` | Proxy do DANFE, emissão NFC-e/NF-e, cancelamento, inutilização, injeção de QR Code e Nome Fantasia. |
| `server/src/routes/settings.ts` | Endpoints de leitura e salvamento de configurações de impressoras com defaults seguros. |
| `electron/main.cjs` | Ciclo de vida Electron, janelas de impressão térmica (`print-pdf-silent`) e A4 (`print-pdf-dialog`). |
| `electron/preload.cjs` | Ponte de IPC segura entre o React e o processo nativo do Electron. |
| `client/src/views/PrinterSettingsView.tsx` | Painel completo de calibração térmica, réguas milimétricas, sliders e simulador em tempo real. |
| `client/src/views/FiscalSettingsView.tsx` | Configuração de dados fiscais, certificado A1, CSC, Token Focus NFe e Nome Fantasia. |
| `client/src/views/NfeReprintView.tsx` | Consulta e reimpressão de 2ª via da NF-e (A4) com diálogo do sistema. |
| `client/src/views/NfceReprintView.tsx` | Consulta e reimpressão de 2ª via do Cupom Fiscal NFC-e (térmica direta). |

---

## 7. 🔄 SISTEMA DE ATUALIZAÇÃO AUTOMÁTICA (AUTO-UPDATER)
- **Objetivo:** O cliente no Windows não precisa mais baixar manualmente o executável do GitHub ou pedir suporte para atualizar. O próprio Bar ERP detecta, notifica, baixa e instala com 1 clique.
- **Detecção de Versão & Resiliência a Rate Limit (Zero 403 Errors):**
  - **Estratégia 1 (`version.json`):** Baixa o arquivo de metadados diretamente dos assets da release (`/releases/download/latest/version.json`). Compara o hash do commit (`remote.commit !== local.commit`) com 100% de precisão cirúrgica sem depender de fuso horário.
  - **Estratégia 2 (Feed Público Atom + Asset HEAD):** Lê o feed XML público (`/releases.atom`) e faz requisição `HEAD` no executável (`/BarERP-Instalador-Windows.exe`) para obter `last-modified` e tamanho do arquivo. Servido pelos CDNs públicos do GitHub com zero limites de requisições por hora (nunca sofre bloqueio 403).
  - **Estratégia 3 (API REST GitHub):** Fallback adicional em `https://api.github.com/repos/pblfrnc/bar-erp/releases/latest`.
  - **Fallback para Builds Anteriores:** Caso o aplicativo em execução não possua `build-info.json` (versões antigas), o sistema adota a data base `2026-01-01T00:00:00.000Z`, garantindo que qualquer versão no GitHub seja imediatamente detectada como uma atualização disponível.
  - **Agendamento automático:** 15s após inicialização do app e recorrente a cada 4 horas, além do botão sob demanda em Configurações.
- **Ciclo do CI/CD no GitHub Actions:**
  - O fluxo compila o executável do Windows (.exe) e os dois APKs Android. Esse processo leva entre **15 a 25 minutos** no GitHub. A nova versão só estará disponível para o aplicativo detectar depois que o job `publish-release` for concluído com sucesso.
- **Interface e Experiência do Usuário (UI/UX):**
  - **Banner Flutuante:** Aparece no canto inferior direito quando há nova versão disponível, permitindo "Ver Detalhes" ou "Lembrar mais tarde".
  - **Badge no Navbar:** Botão pulsante colorido no topo do sistema exibindo "Nova Versão".
  - **Modal Completo de Atualização (`UpdateNotificationModal.tsx`):**
    - Comparativo visual da versão/data atual vs versão disponível.
    - Notas da release extraídas diretamente do GitHub Releases.
    - Barra de progresso com porcentagem, total baixado (MB/GB) e velocidade de download estimada.
    - Botão de instalação imediata: "Reiniciar e Atualizar Agora".
- **Download e Instalação (`electron/updater.cjs`):**
  - Suporte a redirecionamento HTTP 302 (GitHub -> Amazon AWS S3 / Azure Blob) via `fetchWithRedirects`.
  - Download salvo na pasta temporária do usuário (`app.getPath('temp')/BarERP-Update.exe`).
  - Execução desanexada (`spawn` com `detached: true`, `stdio: 'ignore'`) e encerramento limpo do Electron (`app.quit()`).
- **Segurança do Banco de Dados SQLite:**
  - O banco SQLite do cliente fica isolado em `%APPDATA%\BarERP\bar.db` (`app.getPath('userData')`).
  - A reinstalação do `.exe` altera apenas os binários do aplicativo e NUNCA apaga ou sobrescreve os dados, mesas, caixa ou estoque do cliente.

---

## 8. 📁 MAPEAMENTO DE ARQUIVOS DO ATUALIZADOR
| Arquivo | Função Principal |
| :--- | :--- |
| `electron/updater.cjs` | Lógica de consulta ao GitHub, download em background com cálculo de progresso e disparo do instalador. |
| `electron/main.cjs` | Inicialização do módulo updater e comunicação com a janela principal (`setupAutoUpdater`). |
| `electron/preload.cjs` | Exposição segura dos métodos e ouvintes IPC de atualização para o React. |
| `client/src/components/UpdateNotificationModal.tsx` | Banner flutuante e modal interativo de notas de release, progresso e atualização com 1 clique. |
| `client/src/components/Navbar.tsx` | Badge de alerta pulsante quando `hasUpdate` é detectado. |
| `client/src/views/SettingsView.tsx` | Card visual de verificação sob demanda e detalhes da compilação. |
| `.github/workflows/build-artifacts.yml` | Injeção do `build-info.json` com timestamp UTC e commit hash durante a compilação no CI/CD. |

---

## 9. 🚀 REGRAS PARA MANUTENÇÕES FUTURAS
1. **Nunca enviar NF-e (Modelo 55) para `printPdfSilent`:** A NF-e sempre deve usar `printPdfDialog` para abrir o diálogo de impressão A4 do sistema.
2. **Nunca remover a neutralização do script de 250px da Focus:** Se removida, o QR Code voltará a sair gigante no cupom térmico.
3. **Preservar a tolerância de esquemas no SQLite:** Sempre manter os métodos `*Safe` com fallback para SQL bruto ao lidar com configurações fiscais e de impressão.
4. **Respeitar as diretrizes da SEFAZ:** O QR Code padrão deve permanecer entre 75px e 115px (padrão 100px) e o cabeçalho deve conter o Nome Fantasia + Razão Social + CNPJ.
5. **Preservar o fluxo não destrutivo do instalador NSIS:** O instalador deve continuar instalando sobre a versão anterior mantendo o diretório `userData` intacto.

---

## 10. 🛡️ PAINEL DO DESENVOLVEDOR & ATIVAÇÃO REMOTA (SOFTWARE HOUSE)
- **Painel Independente (`dev-panel/`):**
  - Aplicação autônoma que roda na porta `4500` com banco SQLite próprio em `dev-panel/data/software_house.db`.
  - Comandos: `npm run panel:start` (produção) ou `npm run panel:dev` (desenvolvimento).
  - Dashboard completo com faturamento estimado, clientes cadastrados, licenças ativas, vencendo em até 7 dias e bloqueadas/expiradas.
  - Ação rápida de 1 clique: **⚡ Renovar +30d** (recalcula a validade a partir do vencimento futuro ou de hoje se vencido, e grava no histórico de pagamentos).
  - Botão de WhatsApp direto com mensagem pré-formatada de confirmação.
  - Gerador de **Chave de Ativação Offline** compacta (`EXP-AAAAMMDD-XXXX-YYYY`) assinada com HMAC-SHA256.
- **Mecanismo de Ativação no Bar ERP:**
  - O Bar ERP consulta periodicamente ou sob demanda o endpoint público `GET /api/v1/licenses/check/:machineId`.
  - Ao receber o comprovante no WhatsApp e o ID da máquina, o desenvolvedor ativa no painel e o Bar ERP destrava remotamente sem necessidade de AnyDesk ou TeamViewer.
  - Se o bar estiver sem internet no momento da ativação, o cliente pode colar a chave offline na tela de ativação.
  - Faltando 5 dias ou menos para o vencimento da mensalidade, a barra superior exibe um alerta sutil e pulsante com a contagem regressiva de dias e os dados de pagamento PIX.

---

## 11. 💳 GESTÃO DE ASSINATURA & RENOVAÇÃO ANTECIPADA NA RETAGUARDA
- **Localização:** Retaguarda do Bar ERP > Card **Assinatura & Licença** (`client/src/views/SubscriptionView.tsx`).
- **Acesso do Usuário (Não Bloqueado):**
  - O cliente tem acesso a qualquer momento através do menu Retaguarda ou pelo modal de aviso de vencimento.
  - Permite visualizar o status operacional, data de expiração exata e o contador de dias restantes.
- **ID da Máquina com 1 Clique:**
  - Exibição em destaque do ID único do terminal com botão de cópia rápida e feedback visual.
- **Renovação Antecipada Sem Perda de Dias (Acúmulo Inteligente):**
  - O cliente pode escolher pagar meses antecipados:
    - `+1 Mês (30 dias)`
    - `+3 Meses (90 dias)`
    - `+6 Meses (180 dias)`
    - `+12 Meses (365 dias - 1 Ano)`
  - **Cálculo em Tempo Real:** A interface projeta e exibe a nova data de expiração somando os novos dias ao vencimento atual, garantindo que o cliente não perca nenhum dia já pago.
  - **Botão de WhatsApp Formatado:** Abre conversa com o desenvolvedor enviando:
    - ID da máquina
    - Período escolhido
    - Validade atual e data futura projetada
    - Mensagem solicitando a liberação com comprovante PIX anexado.
- **Sincronização Online Instantânea:**
  - Botão **"Sincronizar com Servidor"** (`POST /api/settings/license/sync-remote`), que consulta o servidor de licenças e atualiza imediatamente a validade e os dias restantes sem precisar reiniciar o sistema.
- **Ativação Offline Reserva:**
  - Sanfona expansível para inserção de chave criptográfica offline fornecida pelo desenvolvedor caso o estabelecimento esteja sem conexão de internet.

---

## 12. 📦 1º BIP & RECEBIMENTO DE NF-E (MANIFESTO & SEFAZ RESILIENTE)
- **Fluxo em 2 Etapas:**
  1. **1º Bip (Entrada da Carga / Leitor de Chave de 44 dígitos):**
     - Registra o manifesto de **Ciência da Operação** na SEFAZ via Focus NFe (`POST /v2/nfes_recebidas/:chave/manifesto` com `{ tipo: "ciencia" }`).
     - Tenta baixar o XML oficial da NF-e distribuído pela SEFAZ.
     - **Tolerância e Resiliência à SEFAZ:** A SEFAZ costuma demorar entre 30s e 90s para disponibilizar o XML consolidado com o protocolo de autorização após o registro da ciência.
     - **Eliminação do erro 400 da Focus:** O sistema extrai todos os metadados (UF, Ano/Mês, CNPJ formatado do emitente, modelo 55, série e número) matematicamente a partir da própria chave de 44 dígitos via `parseChaveAcessoNfe(chave)`.
     - Se o XML ainda não estiver disponível, o sistema **não falha com erro 400**. Salva o registro no SQLite com status `ciencia_registrada` e notifica o usuário com instruções claras.
     - Permite upload direto do XML fornecido pelo fornecedor ou avanço para a conferência quando a SEFAZ liberar.
  2. **2º Bip (Conferência Físico-Fiscal / Descarregamento dos Itens):**
     - O operador bipe ou confere os itens e códigos de barras DANFE.
     - Aplica a vinculação com produtos existentes ou novos no estoque.
     - Atualiza custos, tributos e quantitativos no estoque.
  3. **Temporizador em Segundo Plano (`setupNfeAutoSyncScheduler`):**
     - Roda a cada 15 minutos de forma silenciosa e resiliente (`server/src/services/nfeRecebidasScheduler.ts`).
     - Consulta notas destinadas na Focus NFe / SEFAZ, registra manifestos pendentes e baixa os arquivos XML automaticamente.
     - Quando o caminhão chega com a DANFE física, o XML e os valores já estão pré-carregados no banco local, tornando o 1º Bip 100% instantâneo.

---

## 13. 🔒 CAMADA C: CRIPTOGRAFIA DE DADOS EM REPOUSO (SECURITY VAULT)
- **Módulo:** `server/src/services/securityVault.ts`
- **Padrões Adotados:**
  1. **AES-256-GCM com Scrypt (`encryptField` / `decryptField`):**
     - Chaves Fiscais da SEFAZ (`apiToken` e `cscSecret` em `FiscalSettings`).
     - Dados Pessoais de Clientes / Fiado (`phone`, `document` CPF/CNPJ, `notes` em `Customer`).
     - Saída no banco no formato seguro: `$enc$v1$<iv_hex>$<authTag_hex>$<ciphertext_hex>`.
     - Se alguém abrir o `.db` local no *DB Browser for SQLite*, só verá hashes ilegíveis e ruído binário.
  2. **Hash PBKDF2 SHA-512 com Salt Individual (`hashPassword` / `verifyPassword`):**
     - Senhas e PINs de funcionários e administradores (`password` em `Staff`).
     - Saída no formato: `$pbkdf2$<salt_hex>$<hash_hex>`.
     - Impossibilita ataques de dicionário e rainbow tables.
     - Compatibilidade retroativa transparente preservada para acessos legados.




