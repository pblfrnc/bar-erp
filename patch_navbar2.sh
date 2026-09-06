# Remove the prop interfaces properly
sed -i '' -e '/onOpenWaitersModal: () => void;/d' client/src/components/Navbar.tsx
sed -i '' -e '/onOpenConnectMobile?: () => void;/d' client/src/components/Navbar.tsx
sed -i '' -e '/autoPrintKitchen?: boolean;/d' client/src/components/Navbar.tsx
sed -i '' -e '/onToggleAutoPrintKitchen?: () => void;/d' client/src/components/Navbar.tsx

# Remove the props from component definition
sed -i '' -e '/onOpenWaitersModal,/d' client/src/components/Navbar.tsx
sed -i '' -e '/onOpenConnectMobile,/d' client/src/components/Navbar.tsx
sed -i '' -e '/autoPrintKitchen,/d' client/src/components/Navbar.tsx
sed -i '' -e '/onToggleAutoPrintKitchen/d' client/src/components/Navbar.tsx

# Add Settings view
sed -i '' -e "s/ | 'audit'/ | 'audit' | 'settings'/g" client/src/components/Navbar.tsx
sed -i '' -e 's/ShieldAlert,/ShieldAlert, Settings,/' client/src/components/Navbar.tsx
sed -i '' -e '/id: '"'audit'"' as const,/i\
    {\
      id: '"'settings'"' as const,\
      label: '"'Configurações'"',\
      icon: Settings,\
      badge: null\
    },\
' client/src/components/Navbar.tsx

