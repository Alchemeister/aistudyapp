
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [
      react()
    ],
    assetsInclude: ['**/*.min.js'],
    optimizeDeps: {
      // Exclude pdfjs-dist so it isn't bundled by Vite, forcing the browser
      // to resolve it via the importmap in index.html (v3.11.174)
      exclude: ['pdfjs-dist']
    },
    build: {
      target: 'esnext',
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || ''),
    },
  };
});
