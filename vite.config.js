import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const base = process.env.VITE_BASE_PATH
    || (process.env.GITHUB_ACTIONS && repository ? `/${repository}/` : '/');

  return {
    base,
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: loadEnv(mode, process.cwd(), 'API_').API_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
