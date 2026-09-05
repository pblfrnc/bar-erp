const fs = require('fs');
let code = fs.readFileSync('client/src/App.tsx', 'utf-8');

const returnStatement = "if (appMode === 'waiter') {";
const patch = `
  if (isLicensed === false) {
    return <LicenseModal machineId={machineId} onSuccess={loadSettings} />;
  }

  if (appMode === 'waiter') {
`;
code = code.replace(returnStatement, patch);

fs.writeFileSync('client/src/App.tsx', code);
