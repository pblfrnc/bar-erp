sed -i '' -e 's/import React from '"'"'react'"'"';/import React, { useState, useEffect } from '"'"'react'"'"';/g' client/src/views/SettingsView.tsx
sed -i '' -e 's/ChevronRight } from '"'"'lucide-react'"'"';/ChevronRight, ShieldCheck } from '"'"'lucide-react'"'"';\
import { api } from '"'"'..\/services\/api'"'"';/g' client/src/views/SettingsView.tsx

sed -i '' -e '/export const SettingsView: React.FC<SettingsViewProps> = ({/a\
  const [backupInfo, setBackupInfo] = useState<any>(null);\
  useEffect(() => {\
    api.getBackupStatus().then(setBackupInfo).catch(() => {});\
  }, []);\
' client/src/views/SettingsView.tsx

sed -i '' -e '/{/* Grid de Opções */}/a\
\
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-4 flex items-center justify-between">\
        <div className="flex items-center gap-4">\
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">\
            <ShieldCheck className="w-6 h-6" />\
          </div>\
          <div>\
            <h3 className="text-base font-bold text-white">Backup Automático do Banco</h3>\
            <p className="text-xs text-slate-400 mt-0.5">\
              {backupInfo?.totalBackups \
                ? `${backupInfo.totalBackups} backups salvos. Último: ${backupInfo.lastBackup}` \
                : "Ativado. Backups são salvos no AppData do Windows todos os dias."}\
            </p>\
          </div>\
        </div>\
        <span className="text-[10px] font-black uppercase text-indigo-400 bg-indigo-500/20 px-2 py-1 rounded">Protegido</span>\
      </div>\
' client/src/views/SettingsView.tsx
