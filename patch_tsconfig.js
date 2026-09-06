const fs = require('fs');
let code = fs.readFileSync('server/tsconfig.json', 'utf8');

code = code.replace(
  '"strict": true,',
  '"strict": false,\n    "noImplicitAny": false,'
);

fs.writeFileSync('server/tsconfig.json', code);
