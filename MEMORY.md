# 🧠 MEMÓRIA E CONTEXTO ARQUITETURAL DO BAR ERP PRO
> **Data de Atualização:** 11 de Setembro de 2026  
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

## 7. 🚀 REGRAS PARA MANUTENÇÕES FUTURAS
1. **Nunca enviar NF-e (Modelo 55) para `printPdfSilent`:** A NF-e sempre deve usar `printPdfDialog` para abrir o diálogo de impressão A4 do sistema.
2. **Nunca remover a neutralização do script de 250px da Focus:** Se removida, o QR Code voltará a sair gigante no cupom térmico.
3. **Preservar a tolerância de esquemas no SQLite:** Sempre manter os métodos `*Safe` com fallback para SQL bruto ao lidar com configurações fiscais e de impressão.
4. **Respeitar as diretrizes da SEFAZ:** O QR Code padrão deve permanecer entre 75px e 115px (padrão 100px) e o cabeçalho deve conter o Nome Fantasia + Razão Social + CNPJ.
