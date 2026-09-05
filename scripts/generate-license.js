const { createHmac } = require('crypto');

const SECRET_KEY = 'BAR_ERP_SUPER_SECRET_KEY_2026';

const email = process.argv[2];
const machineId = process.argv[3];

if (!email || !machineId) {
  console.log("Uso: node generate-license.js <email> <machineId>");
  process.exit(1);
}

const key = createHmac('sha256', SECRET_KEY)
  .update(`${email}:${machineId}`)
  .digest('hex');

console.log(`\nEmail: ${email}`);
console.log(`Machine ID: ${machineId}`);
console.log(`\nCHAVE DE LICENÇA (Copie isto para o cliente):`);
console.log(key);
console.log("\n");
