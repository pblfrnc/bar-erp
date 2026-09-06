const fs = require('fs');
let code = fs.readFileSync('server/src/index.ts', 'utf8');

code = code.replace(
  "import { createOrdersRouter } from './routes/orders.js';",
  "import { createOrdersRouter } from './routes/orders.js';\nimport { createFiscalRouter } from './routes/fiscal.js';"
);

code = code.replace(
  "app.use('/api/waiters', createWaitersRouter());",
  "app.use('/api/waiters', createWaitersRouter());\napp.use('/api/fiscal', createFiscalRouter());"
);

fs.writeFileSync('server/src/index.ts', code);
