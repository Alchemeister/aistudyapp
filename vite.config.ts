import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react({
        jsxRuntime: 'classic',
      })
    ],
    assetsInclude: ['**/*.min.js'],
    build: {
      target: 'es2020',
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        external: ['react', 'react-dom'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
          },
        },
      },
    },
    resolve: {
      dedupe: ['react', 'react-dom', 'react-router-dom'],
    },
    optimizeDeps: {
      include: ['react-router-dom'],
      esbuildOptions: {
        target: 'es2020',
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || ''),
    },
  };
});