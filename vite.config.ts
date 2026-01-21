import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
  },
  // SECURITY: No API keys exposed to client bundle
  // All AI calls go through /api/generate and /api/chat
});
