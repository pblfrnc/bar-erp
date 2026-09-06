sed -i '' -e '/{currentView === '"'dashboard'"' && (/i\
        {currentView === '"'audit'"' && (\
          <AuditView />\
        )}\
\
        {currentView === '"'settings'"' && (\
          <SettingsView \
            onOpenWaitersModal={() => setShowWaitersModal(true)}\
            onOpenConnectMobile={() => setShowConnectMobileModal(true)}\
            autoPrintKitchen={autoPrintKitchen}\
            onToggleAutoPrintKitchen={() => setAutoPrintKitchen(!autoPrintKitchen)}\
          />\
        )}\
' client/src/App.tsx
