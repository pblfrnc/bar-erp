import fs from 'fs';
let f = fs.readFileSync('client/src/views/FiscalSettingsView.tsx', 'utf-8');

f = f.replace(`            <input
              type="text"
              type="password"
              value={settings.apiToken || ''}
              onChange={e => handleChange('apiToken', e.target.value)}`, `            <input
              type="password"
              value={settings.apiToken || ''}
              onChange={e => handleChange('apiToken', e.target.value)}`);

// Also fix if it was just type="text"
f = f.replace(`            <input
              type="text"
              value={settings.apiToken || ''}
              onChange={e => handleChange('apiToken', e.target.value)}`, `            <input
              type="password"
              value={settings.apiToken || ''}
              onChange={e => handleChange('apiToken', e.target.value)}`);

fs.writeFileSync('client/src/views/FiscalSettingsView.tsx', f);
