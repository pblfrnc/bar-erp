const fs = require('fs');
let code = fs.readFileSync('client/src/App.tsx', 'utf8');

code = code.replace(
  "  if (isLicensed === false) {\n    return <LicenseModal machineId={machineId} onSuccess={loadSettings} />;\n  }\n",
  ""
);

code = code.replace(
  "setIsLicensed(data.isLicensed);",
  ""
);

code = code.replace(
  "const [isLicensed, setIsLicensed] = useState<boolean | null>(null);",
  ""
);

code = code.replace(
  "import { LicenseModal } from './components/LicenseModal';\n",
  ""
);

fs.writeFileSync('client/src/App.tsx', code);
