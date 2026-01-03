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
    resolve: {
      alias: {
        react: path.resolve('./node_modules/react'),
        'react-dom': path.resolve('./node_modules/react-dom'),
      },
      dedupe: ['react', 'react-dom'],
    },
    assetsInclude: ['**/*.min.js'],
    build: {
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || ''),
    },
  };
});