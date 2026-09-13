# 🍺 BarERP Pro • Sistema de Gestão Completo para Bares, Restaurantes, Mesas & KDS

![BarERP Pro](https://img.shields.io/badge/Versão-1.7.5-amber?style=for-the-badge)
![React 19](https://img.shields.io/badge/React_19-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Prisma ORM](https://img.shields.io/badge/Prisma_ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Electron](https://img.shields.io/badge/Electron_Windows-47848F?style=for-the-badge&logo=electron&logoColor=white)
![Android Capacitor](https://img.shields.io/badge/Android_APK-3DDC84?style=for-the-badge&logo=android&logoColor=white)

> **BarERP Pro** é um ecossistema completo de gestão comercial e operacional de alta performance desenvolvido especialmente para **bares, choperias, gastrobares, pubs, restaurantes e lounges**.
> 
> Unifica em uma única plataforma o controle dinâmico de mesas, comanda eletrônica mobile para garçons, KDS em tempo real para Bar e Cozinha, frente de caixa (PDV) com fechamento cego, módulo fiscal completo (NFC-e, NF-e, importação de XML), dashboards gerenciais e acessibilidade com fontes grandes para baixa visão.

---

## 📑 Sumário

1. [Visão Geral dos Módulos](#-visão-geral-dos-módulos)
2. [Funcionalidades em Destaque](#-funcionalidades-em-destaque)
   - [1. Gestão Dinâmica de Mesas & Comandas](#1--gestão-dinâmica-de-mesas--comandas)
   - [2. KDS (Kitchen Display System) em Tempo Real](#2--kds-kitchen-display-system-em-tempo-real)
   - [3. Comanda Mobile do Garçom (Tablet & Celular)](#3--comanda-mobile-do-garçom-tablet--celular)
   - [4. Frente de Caixa (PDV) & Controle de Turnos](#4--frente-de-caixa-pdv--controle-de-turnos)
   - [5. Módulo Fiscal Completo (NFC-e, NF-e & Entrada de Notas)](#5--módulo-fiscal-completo-nfc-e-nf-e--entrada-de-notas)
   - [6. Dashboard Gerencial & Auditoria Cega](#6--dashboard-gerencial--auditoria-cega)
   - [7. Controle de Estoque & Ficha Técnica (Composição)](#7--controle-de-estoque--ficha-técnica-composição)
   - [8. Impressão Térmica (80mm e 58mm) & WhatsApp](#8--impressão-térmica-80mm-e-58mm--whatsapp)
   - [9. Controle de Acesso, Usuários & Segurança](#9--controle-de-acesso-usuários--segurança)
   - [10. Acessibilidade Nativa (Baixa Visão & Alto Contraste)](#10--acessibilidade-nativa-baixa-visão--alto-contraste)
3. [Arquitetura & Tecnologias](#-arquitetura--tecnologias)
4. [Como Gerar o APK Nativo para Android](#-como-gerar-o-apk-nativo-para-android)
5. [Como Gerar o Executável para Windows (.EXE)](#-como-gerar-o-executável-para-windows-exe)
6. [Como Executar em Desenvolvimento](#-como-executar-em-desenvolvimento)
7. [Estrutura de Diretórios](#-estrutura-de-diretórios)

---

## 🎯 Visão Geral dos Módulos

```
                      ┌──────────────────────────────────────────┐
                      │               BAR ERP PRO                │
                      └────────────────────┬─────────────────────┘
                                           │
         ┌──────────────────┬──────────────┴─────┬──────────────────┐
         │                  │                    │                  │
         ▼                  ▼                    ▼                  ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ SALÃO & MESAS  │ │ KDS BAR/COZINHA│ │ CAIXA & PDV    │ │ RETAGUARDA     │
│ • Mapa Visual  │ │ • WebSockets   │ │ • Abertura     │ • Fiscal NFCe/NFe│
│ • Comanda Mob. │ │ • Fila em Real │ │ • Fechamento   │ • Importação XML │
│ • Divisão Conta│ │   Time         │ │ • Sangria/Supr.│ • Painel Contador│
│ • Taxa Serviço │ │ • Chime Sonoro │ │ • QR Code PIX  │ • Dashboard      │
│ • Transfer/Junc│ │ • Status Prep. │ │ • Venda Rápida │ • Auditoria Cega │
└────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘
```

---

## ✨ Funcionalidades em Destaque

### 1. 🪑 Gestão Dinâmica de Mesas & Comandas
- **Mapa Interativo de Salão**: Acompanhamento visual de status em tempo real (**Livre**, **Ocupada**, **Fechando** e **Conta Solicitada**).
- **Lançamento Rápido de Pedidos**: Busca preditiva de produtos, categorias visuais e suporte a observações personalizadas por item (ex: *"Sem cebola"*, *"Com gelo e limão"*, *"Ponto da carne: mal passado"*).
- **Transferência Inteligente**:
  - Transferência total de mesa (ex: cliente mudou da Mesa 04 para a Mesa 12).
  - Transferência fracionada de itens específicos entre comandas.
- **Junção de Mesas (Merge)**: Permite agrupar várias mesas em um único consumo consolidado para grandes grupos ou famílias.
- **Divisão Flexível de Conta**: Divisão automática do total por número de pagantes ou cálculo individual por produtos consumidos.
- **Taxa de Serviço Flexível**: Apuração automática da comissão/gorjeta de serviço (10% padrão, ativável ou dispensável na conferência da mesa).

---

### 2. 🧑‍🍳 KDS (Kitchen Display System) em Tempo Real
- **Sincronização Instantânea**: Alimentado por **WebSockets (Socket.IO)**, atualiza os pedidos na tela da cozinha e do bar sem necessidade de recarregar página.
- **Divisão Automática por Praça**:
  - 🍺 **Praça do Bar**: Bebidas, chopes, drinks, doses e garrafas.
  - 🍳 **Praça da Cozinha**: Porções, pratos quentes, petiscos e sobremesas.
- **Alerta Sonoro (Chime)**: Notificação sonora a cada novo pedido emitido pelo salão, chamando a atenção dos cozinheiros e barmen imediatamente.
- **Ciclo de Preparação Visual**:
  `Na Fila` ➔ `Preparando` ➔ `Pronto` ➔ `Entregue`
- **Cronômetro com Código de Cores**: Marcadores de tempo decorrido que alertam visualmente sobre pedidos com atraso (verde, amarelo e vermelho).
- **Ficha de Produção**: Impressão direta do ticket de preparo para a chapa ou balcão de drinks.

---

### 3. 📱 Comanda Mobile do Garçom (Tablet & Celular)
- **Interface Mobile-First**: Otimizada para operação com apenas uma mão em smartphones e tablets.
- **Conexão Instantânea via QR Code**: Botão na tela do caixa gera um QR Code com o IP da rede local Wi-Fi. Basta o garçom apontar a câmera do celular para começar a usar, sem precisar de internet externa.
- **App Nativo Android (APK)**: Projeto Capacitor integrado, compilado e assinado em modo Release para instalação limpa em qualquer aparelho Android (sem avisos de risco).
- **Controle de Comissões**: Apuração em tempo real do volume de vendas e comissões por garçom.

---

### 4. 💵 Frente de Caixa (PDV) & Controle de Turnos
- **Abertura de Caixa**: Controle de operador, data/hora e fundo de troco inicial.
- **Fechamento Cego de Caixa**: O operador digita os valores contados fisicamente na gaveta sem ver o total do sistema. O ERP compara os valores e gera o relatório detalhado de sobras ou faltas.
- **Movimentações de Caixa**:
  - **Sangria**: Retiradas de dinheiro com motivo, valor e operador auditados.
  - **Suprimento**: Aportes adicionais de troco com justificativa.
- **Múltiplos Meios de Pagamento**: Permite quitar uma comanda dividindo o valor entre **Dinheiro**, **PIX**, **Cartão de Débito**, **Cartão de Crédito** e **Voucher**.
- **PIX Dinâmico Integrado**: Geração instantânea de QR Code PIX com valor exato na tela do caixa para o cliente escanear e pagar.
- **Venda Rápida de Balcão**: Venda direta de itens no caixa sem a necessidade de abrir mesa.
- **Histórico e Estorno de Comandas**: Consulta de todas as contas pagas no turno, com opção de cancelamento auditado e reimpressão de cupom.

---

### 5. 🧾 Módulo Fiscal Completo (NFC-e, NF-e & Entrada de Notas)
- **Emissão de NFC-e (Modelo 65)**: Emissão direta de Cupom Fiscal do Consumidor no fechamento da comanda ou venda rápida, com QR Code oficial da SEFAZ.
- **Emissão de NF-e (Modelo 55)**: Emissão de Nota Fiscal Eletrônica completa para clientes corporativos (PJ), devoluções e remessas.
- **Monitoramento da SEFAZ em Tempo Real**: Indicador de status de comunicação com a SEFAZ do estado (ex: PA / SVRS / Ambiente Nacional).
- **Cancelamento & Inutilização**: Rotinas completas de cancelamento de notas emitidas e inutilização de numeração fiscal com justificativas auditadas.
- **Reimpressão de DANFE**: Visualização e impressão de qualquer nota fiscal emitida no sistema.
- **Recebimento de Mercadorias com Leitor de Código de Barras**: Entrada de estoque por bip da chave de acesso de 44 dígitos da DANFE impressa.
- **Importação Inteligente de XML de Fornecedor**:
  - Identificação de produtos do fornecedor e vinculação com o catálogo existente.
  - Cadastro automático de novos itens com dados fiscais (NCM, CEST, CST).
  - Conversão inteligente de unidades (ex: caixa com 12 ou 24 unidades convertida para unidade de venda).
  - Atualização automática do estoque e recálculo de preço de custo.
- **Painel do Contador**: Exportação mensal em arquivo `.ZIP` contendo todos os XMLs de notas emitidas e canceladas, facilitando a escrituração contábil.

---

### 6. 📈 Dashboard Gerencial & Auditoria Cega
- **Indicadores Chave do Dia (KPIs)**:
  - Faturamento total líquido.
  - Quantidade de comandas finalizadas.
  - Ticket médio por mesa.
  - Taxa de ocupação de mesas do salão.
- **Filtro por Data Dinâmico**: Permite consultar o histórico de qualquer dia com tratamento preciso de fuso horário local.
- **Ranking de Produtos Mais Vendidos**: Top 5 itens líderes de venda com separação por praça (Bar e Cozinha).
- **Curva Horária de Movimento**: Gráfico de distribuição de vendas por hora para identificar horários de pico e otimizar escalas de atendimento.
- **Pódio de Performance dos Garçons**: Ranking de faturamento e quantidade de atendimentos realizados por cada colaborador.
- **Alerta de Lucratividade**: Identificação automática de itens com margem de lucro perigosa (< 30%) para revisão de precificação ou troca de fornecedor.
- **Auditoria Cega (Audit Logs)**: Registro inviolável de todas as ações sensíveis do sistema (cancelamento de itens, exclusão de comandas, estornos de pagamentos e sangrias), com identificação do operador e timestamp.

---

### 7. 📦 Controle de Estoque & Ficha Técnica (Composição)
- **Cadastro Completo de Produtos**: Preço de venda, preço de custo, margem de lucro, código de barras, NCM, CEST, CFOP, CSOSN e alíquotas fiscais.
- **Ficha Técnica & Baixa de Insumos**: Composição de produtos compostos (ex: o drink "Caipirinha" debita automaticamente 50ml de cachaça, 1 limão e 20g de açúcar do estoque).
- **Estoque Mínimo & Reposição**: Avisos visuais quando produtos atingem o estoque crítico.
- **Gestão de Fornecedores & Clientes**: Cadastro completo com contatos, histórico de compras/consumo e controle de fiado.

---

### 8. 🖨️ Impressão Térmica (80mm e 58mm) & WhatsApp
- **Layout Térmico Otimizado**: Compatível com bobinas de 80mm e 58mm, com margens e tamanhos configuráveis.
- **Impressão de Pré-Conta / Conferência**: Extrato claro para apresentação na mesa antes do pagamento.
- **Envio de Cupom via WhatsApp**: Botão para enviar a conferência da mesa detalhada diretamente para o WhatsApp do cliente em texto limpo e formatado.
- **Compatibilidade Ampla**: Funciona via spooler do Windows, impressoras de rede (ESC/POS via IP) ou aplicativo **RawBT** no Android para impressoras térmicas Bluetooth e USB.

---

### 9. 🛡️ Controle de Acesso, Usuários & Segurança
- **Perfis de Usuário**: Perfis pré-configurados para **Administrador**, **Gerente**, **Caixa**, **Garçom** e **Cozinha**.
- **Permissões Granulares**: Restrição de acesso por tela e por operação (ex: apenas gerentes podem cancelar itens já enviados para a cozinha).
- **Banco de Dados Local SQLite**: Todos os dados ficam salvos localmente na máquina do estabelecimento, garantindo que o sistema funcione mesmo sem internet.
- **Backup e Restauração**: Rotinas de exportação e importação de backup do banco de dados com um clique.
- **Atualização Automática (Electron Auto-Updater)**: O aplicativo desktop para Windows verifica e aplica novas atualizações automaticamente em segundo plano.

---

### 10. 👁️ Acessibilidade Nativa (Baixa Visão & Alto Contraste)
Pensado para operadores com dificuldades visuais e para o ambiente de baixa iluminação típico de bares e casas noturnas:
- **Seletor de Escala Instantâneo (`A+`)**: Alterne entre **Normal (100%)**, **Grande (125%)** e **Extra Grande (140%)** diretamente no topo do sistema.
- **Números de Mesas em Destaque Gigante**: Tipografia `font-black` com tamanhos de 36px a 48px legíveis a metros de distância.
- **Tema Escuro de Alto Contraste**: Fundo escuro profundo com paleta em Dourado/Âmbar, Esmeralda e Índigo, eliminando a fadiga visual.
- **Áreas de Toque Aumentadas**: Botões e alvos de clique com altura mínima de 56px, perfeitos para agilidade no touch screen de celulares e tablets.

---

## 🛠️ Arquitetura & Tecnologias

| Camada | Tecnologia | Destaques |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Vite | Interface ultra-reativa, leve e modular |
| **Estilização** | Tailwind CSS + Lucide Icons | Design moderno com tema escuro e responsividade total |
| **Backend** | Node.js + Express + Prisma ORM | API RESTful robusta com tipagem estrita |
| **Banco de Dados** | SQLite | Banco local embarcado, rápido e sem necessidade de servidor externo |
| **Tempo Real** | Socket.IO (WebSockets) | Atualização instantânea entre Caixa, Mesas e KDS |
| **Desktop** | Electron + electron-builder | Instalador `.EXE` para Windows com auto-updater |
| **Mobile** | Capacitor (Android Nativo) | Geração de APK nativo para celulares e tablets de garçons |
| **Fiscal** | Integração SEFAZ + XML Parser | Emissão e recepção de NFC-e (mod. 65) e NF-e (mod. 55) |

---

## 📱 Como Gerar o APK Nativo para Android

O projeto Android nativo completo está localizado na pasta `client/android/` utilizando **Capacitor**.

### Opção A: Compilação Automática via GitHub Actions (Recomendado)
1. Suba as alterações para o seu repositório no GitHub (`git push`).
2. Acesse a aba **Actions** no GitHub.
3. O workflow **"Build Android APK & Windows EXE"** será disparado automaticamente.
4. Baixe o artefato `BarERP-Android-APK` gerado e instale diretamente nos aparelhos Android.

### Opção B: Compilar Localmente via Android Studio
```bash
npm run cap:open
```
1. O Android Studio abrirá o projeto nativo.
2. Acesse o menu superior: **Build ➔ Build Bundle(s) / APK(s) ➔ Build APK(s)**.
3. O arquivo compilado estará em:
   `client/android/app/build/outputs/apk/debug/app-debug.apk`

### Opção C: Compilar via Linha de Comando (com Java JDK configurado)
```bash
npm --prefix client run cap:build
cd client/android
./gradlew assembleDebug
```

---

## 💻 Como Gerar o Executável para Windows (.EXE)

O empacotamento desktop cria tanto o instalador com assistente NSIS quanto a versão portátil (sem necessidade de instalação).

### Opção A: Compilação Automática via GitHub Actions
- A cada push na branch principal, o executável é gerado em ambiente Windows nativo na nuvem.
- Baixe o pacote `BarERP-Windows-Executavel` diretamente na aba **Actions** do repositório.

### Opção B: Compilar Localmente no Windows
```bash
# Gera o Instalador Completo (.exe)
npm run build:exe

# Gera a Versão Portátil (.exe portátil sem instalação)
npm run build:portable
```
Os executáveis finais serão gravados na pasta:
`dist-electron/BarERP Pro Setup 1.0.0.exe` (ou `BarERP-Portatil-Windows.exe`).

---

## 🚀 Como Executar em Desenvolvimento

### 1. Iniciar Servidor e Frontend simultaneamente:
```bash
npm run dev
```
- **Porta do Servidor**: `3001` (`http://localhost:3001`)
- **Porta do Cliente**: `5173` (`http://localhost:5173`)

### 2. Acessos no Estabelecimento:
- **Computador do Caixa / Gerência**: Acesse no navegador `http://localhost:5173` ou execute via Electron (`npm run electron:dev`).
- **Dispositivos dos Garçons (Wi-Fi Local)**:
  1. Conecte os celulares na mesma rede Wi-Fi do computador principal.
  2. Clique no ícone de celular no topo do sistema para ver o QR Code de conexão.
  3. Aponte a câmera dos celulares para abrir diretamente o **Modo Garçom**.

---

## 📁 Estrutura de Diretórios

```
├── client/                     # Frontend React 19 + Tailwind CSS + Vite
│   ├── android/                # Projeto Nativo Android (Capacitor + Gradle)
│   ├── public/manifest.json    # Configuração de PWA (Progressive Web App)
│   ├── src/
│   │   ├── components/         # Navbar, Modais, Cupom Térmico, KDS Ticket, QR Code
│   │   ├── views/              # Mesas, KDS, Caixa PDV, Fiscal, Dashboard, Auditoria
│   │   ├── services/           # Comunicação REST (API) e WebSockets (Socket.IO)
│   │   ├── utils/              # Formatação de moedas, sons (Chime) e impressão
│   │   └── types.ts            # Tipagens TypeScript centrais
├── electron/                   # Empacotamento Desktop Windows (Electron)
│   ├── main.cjs                # Processo Principal, Janela Tela Cheia e F11
│   └── preload.cjs             # Bridge IPC seguro entre React e Sistema Operacional
├── server/                     # Backend Node.js + Express + Prisma
│   ├── prisma/schema.prisma    # Modelagem de dados (Mesas, Pedidos, Caixa, Fiscal)
│   ├── src/
│   │   ├── routes/             # Rotas de mesas, comandas, KDS, caixa, estoque, fiscal
│   │   └── index.ts            # Inicialização HTTP + Socket.IO Server
├── .github/workflows/          # CI/CD para compilação de APK e EXE na nuvem
└── package.json                # Scripts principais de orquestração e build
```

---

## 📄 Licença & Autoria

Desenvolvido por **Pablo Franco** para máxima produtividade e confiabilidade operacional no setor de alimentação e entretenimento.
