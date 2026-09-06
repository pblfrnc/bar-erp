# Reorganização da Interface (Métricas, Fiscal e Configurações)

## 1. Auditoria Cega nas Métricas (Dashboard)
- **Modificar:** `DashboardView.tsx`
- **Ação:** Adicionar um sistema de "Abas" (Tabs) no topo do Dashboard:
  - Aba 1: "Visão Geral" (Gráficos atuais)
  - Aba 2: "Auditoria Cega" (Trazendo o conteúdo do `AuditView.tsx` para cá)
- **Remover:** O botão "Auditoria" da barra lateral (Navbar).

## 2. Criação do Módulo "Fiscal" Central
- **Criar:** `FiscalHubView.tsx` (ou fundir as telas)
- **Ação:** Um painel central com abas ou cards para:
  - Importar XML (Compras / Estoque)
  - Emitir NFC-e Avulsa (Vendas)
- **Modificar:** `Navbar.tsx` para ter apenas um ícone "Fiscal", que abre esse Hub.

## 3. Configurações Fiscais nas Configurações Gerais
- **Modificar:** `SettingsView.tsx`
- **Ação:** Adicionar um botão/card "Configurações Fiscais (Certificado A1 e Focus NFe)" dentro das configurações gerais do sistema. Ao clicar, ele redireciona ou renderiza a tela `FiscalSettingsView`.
- **Remover:** O botão solto de "Configurações Fiscais" que estava na tela Fiscal solto (ou onde ele estava).

Dessa forma o ERP fica muito mais limpo e organizado para o usuário final!
