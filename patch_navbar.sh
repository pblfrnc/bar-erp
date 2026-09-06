# Remove the 3 buttons
sed -i '' -e '/{\/\* Conectar Celular \/ Wi-Fi \*\//,/}<\/button>/d' client/src/components/Navbar.tsx
sed -i '' -e '/{\/\* Gerenciamento de Garçons \*\//,/}<\/button>/d' client/src/components/Navbar.tsx
sed -i '' -e '/{\/\* Auto-Impressão Térmica de Cozinha no PC \*\//,/}<\/button>/d' client/src/components/Navbar.tsx
# Remove the prop interfaces
sed -i '' -e '/onOpenWaitersModal:/d' client/src/components/Navbar.tsx
sed -i '' -e '/onOpenConnectMobile?:/d' client/src/components/Navbar.tsx
sed -i '' -e '/autoPrintKitchen?:/d' client/src/components/Navbar.tsx
sed -i '' -e '/onToggleAutoPrintKitchen?:/d' client/src/components/Navbar.tsx

# Add Settings to lucide-react imports
sed -i '' -e 's/ShieldAlert,/ShieldAlert, Settings,/' client/src/components/Navbar.tsx

# Add settings to navItems (after audit)
sed -i '' -e '/id: '"'audit'"' as const,/i\
    {\
      id: '"'settings'"' as const,\
      label: '"'Configurações'"',\
      icon: Settings,\
      badge: null\
    },\
' client/src/components/Navbar.tsx
