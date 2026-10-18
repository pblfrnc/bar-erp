import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Usa a regra de promoção do ERP (client/src/utils/pricing.ts)
    fs: { allow: ['..'] }
  }
});
