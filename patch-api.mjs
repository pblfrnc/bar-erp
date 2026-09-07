import fs from 'fs';
let f = fs.readFileSync('client/src/services/api.ts', 'utf-8');

const apiFunc = `
  markAsLoss: (orderId: string): Promise<{ success: boolean; message: string; lostAmount: number }> =>
    fetchWithRetry(\`\${getApiUrl()}/orders/\${orderId}/loss\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(res => {
      if (!res.ok) return res.json().then(e => Promise.reject(e));
      return res.json();
    }),
`;

if (!f.includes('markAsLoss')) {
  f = f.replace("payOrder: (", apiFunc + "\n  payOrder: (");
  fs.writeFileSync('client/src/services/api.ts', f);
}
