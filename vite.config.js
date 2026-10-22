import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createManufacturersHandler } from './server/manufacturers.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'FAVORIT_');
  const handler = createManufacturersHandler({
    apiKey: process.env.FAVORIT_API_KEY || env.FAVORIT_API_KEY,
  });
  const installApi = (server) => {
    server.middlewares.use(handler);
  };

  return {
    plugins: [
      react(),
      {
        name: 'favorit-api',
        configureServer: installApi,
        configurePreviewServer: installApi,
      },
    ],
    server: { host: '127.0.0.1' },
    preview: { host: '127.0.0.1' },
  };
});
