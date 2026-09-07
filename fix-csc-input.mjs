import fs from 'fs';
let f = fs.readFileSync('client/src/views/FiscalSettingsView.tsx', 'utf-8');

f = f.replace(`              <input
                type="text"
                value={settings.cscSecret || ''}
                onChange={e => handleChange('cscSecret', e.target.value)}`, `              <input
                type="password"
                value={settings.cscSecret || ''}
                onChange={e => handleChange('cscSecret', e.target.value)}`);

fs.writeFileSync('client/src/views/FiscalSettingsView.tsx', f);
