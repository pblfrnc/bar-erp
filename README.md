# 🍺 BarERP Pro • Sistema de Gestão para Bares, Mesas & KDS

Sistema completo, moderno e de alta performance voltado para bares, choperias e gastrobares, com controle dinâmico de mesas, lançamento ágil de pedidos para garçons, KDS em tempo real para Bar e Cozinha, Frente de Caixa (PDV), **suporte nativo a Fontes Grandes para Baixa Visão**, **projeto nativo Android para geração de APK** e **empacotamento executável para Windows (.EXE)**.

---

## 👁️ Acessibilidade & Fontes Grandes (Baixa Visão)

Pensando em operadores com dificuldades visuais ou ambientes de bar com pouca luz:
- **Seletor de Escala no Topo**: botão `A+` na barra superior para alternar instantaneamente entre **Normal (100%)**, **Grande (125%)** e **Extra Grande (140%)**.
- **Números de Mesas Gigantes**: numeração em destaque com tipografia `font-black` (tamanhos de 36px a 48px).
- **Alto Contraste**: cores vibrantes de alto contraste (Dourado/Âmbar, Verde Esmeralda, Azul Intenso e fundo preto profundo) que reduzem a fadiga visual e aumentam a legibilidade.
- **Botões Aumentados**: áreas de toque com altura mínima de 56px, ideais para touch rápido em tablets e celulares sem errar o clique.

---

## 📱 Como Gerar o APK Nativo para Android

O projeto Android nativo completo já está gerado na pasta `client/android/` utilizando **Capacitor**.

### Opção A: Compilação Automática via GitHub Actions (Recomendado / Sem instalar nada)
1. Suba o código para o seu repositório no GitHub (`git push`).
2. Acesse a aba **Actions** no seu repositório.
3. O workflow **"Build Android APK & Windows EXE"** será executado automaticamente.
4. Ao final, baixe o arquivo `BarERP-Android-APK` gerado nos artefatos da ação e instale direto no celular ou tablet!

### Opção B: Gerar o APK Localmente com Android Studio
1. Com o [Android Studio](https://developer.android.com/studio) instalado:
   ```bash
   npm run cap:open
   ```
2. O Android Studio abrirá o projeto nativo.
3. No menu superior, clique em **Build ➔ Build Bundle(s) / APK(s) ➔ Build APK(s)**.
4. O APK gerado estará em `client/android/app/build/outputs/apk/debug/app-debug.apk`.

### Opção C: Gerar via Linha de Comando (com Java JDK instalado)
```bash
npm --prefix client run cap:build
cd client/android
./gradlew assembleDebug
```

---

## 💻 Como Gerar o Executável para Windows (.EXE)

O projeto está configurado com **Electron** e **electron-builder** para criar o instalador Windows (`.exe` NSIS) e o executável portátil (`portable.exe`).

### Opção A: Compilação Automática via GitHub Actions (Recomendado)
- No workflow do GitHub Actions em `windows-latest`, o executável é compilado nativamente.
- Baixe o instalador `BarERP-Windows-Executavel` diretamente dos artefatos do GitHub.

### Opção B: Compilar em uma máquina Windows ou via terminal
```bash
npm run build:exe
```
O executável final `.exe` será gerado na pasta:
`dist-electron/BarERP Pro Setup 1.0.0.exe` (ou executável portátil sem instalação).

---

## 🚀 Como Executar em Modo de Desenvolvimento (Web / Local)

```bash
# Iniciar Servidor (porta 3001) e Cliente (porta 5173) simultaneamente:
npm run dev
```

- **Acesso no Navegador do Caixa**: `http://localhost:5173`
- **Acesso no Tablet/Celular dos Garçons**: `http://[IP-DO-PC-DO-CAIXA]:5173` (ex: `http://192.168.1.100:5173`)
- **Modo PWA Tela Cheia no Android**: Abra o link no Chrome do Android e clique em *"Adicionar à tela inicial"* para abrir em tela cheia como aplicativo nativo.

---

## 🖨️ Impressão Térmica de Comandas (80mm e 58mm)

- A tela de fechamento de conta conta com o botão **"Imprimir (80mm)"**, que aciona o layout térmico padronizado.
- No Windows: imprime direto na impressora não fiscal do caixa configurada como padrão.
- No Android: compatível com o serviço de impressão nativo do Android ou com aplicativos como **RawBT Print Service** para impressoras térmicas Bluetooth e USB.
- **WhatsApp**: Botão para enviar a conferência detalhada diretamente para o cliente em texto formatado.

---

## 📁 Estrutura do Projeto

```
├── client/                     # Frontend React 19 + Tailwind + Vite
│   ├── android/                # PROJETO NATIVO ANDROID (Capacitor / Gradle)
│   ├── public/manifest.json    # Manifest PWA
│   ├── src/
│   │   ├── components/         # Navbar (com seletor A+), Modais, Cards, Cupom Térmico
│   │   ├── views/              # Mesas, KDS, Caixa PDV, Cardápio, Dashboard
│   │   └── services/           # REST API e Socket.IO
├── electron/                   # Empacotamento Desktop para Windows
│   ├── main.cjs                # Processo Electron com modo tela cheia e F11
│   └── preload.cjs             # Bridge seguro
├── server/                     # Backend Node.js + Express + Prisma + SQLite
│   ├── prisma/schema.prisma    # Modelagem do Banco SQLite
│   └── src/routes/             # Rotas de mesas, pedidos, KDS, caixa e relatórios
├── .github/workflows/          # Compilação automática de APK e EXE na nuvem
└── package.json                # Scripts principais de build e execução
```
