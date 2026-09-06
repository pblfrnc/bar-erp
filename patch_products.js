const fs = require('fs');
let code = fs.readFileSync('server/src/routes/products.ts', 'utf8');

// Update validation schema
code = code.replace(
  "costPrice: z.number().nonnegative().optional(),",
  "costPrice: z.number().nonnegative().optional(),\n  ncm: z.string().optional().nullable(),\n  cfop: z.string().optional().nullable(),"
);

// Update payload for create/update
code = code.replace(
  "const { name, description, price, costPrice, categoryId } = productSchema.parse(req.body);",
  "const { name, description, price, costPrice, categoryId, ncm, cfop } = productSchema.parse(req.body);"
);
code = code.replace(
  "data: { name, description, price, costPrice, categoryId, stock: 100 }",
  "data: { name, description, price, costPrice, categoryId, ncm, cfop, stock: 100 }"
);
code = code.replace(
  "data: { name, description, price, costPrice, categoryId }",
  "data: { name, description, price, costPrice, categoryId, ncm, cfop }"
);

fs.writeFileSync('server/src/routes/products.ts', code);
