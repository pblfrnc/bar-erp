const fs = require('fs');
let code = fs.readFileSync('client/src/views/ManualNfceView.tsx', 'utf8');

code = code.replace(
  "price: i.product.price",
  "price: i.product.price,\n          name: i.product.name,\n          ncm: i.product.ncm,\n          cfop: i.product.cfop"
);

fs.writeFileSync('client/src/views/ManualNfceView.tsx', code);
