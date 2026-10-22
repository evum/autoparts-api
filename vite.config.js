import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createManufacturersHandler } from './server/manufacturers.js';
import { createOffersHandler } from './server/offers.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'FAVORIT_');
  const apiOptions = {
    apiKey: process.env.FAVORIT_API_KEY || env.FAVORIT_API_KEY,
  };
  const installApi = (server) => {
    server.middlewares.use(createManufacturersHandler(apiOptions));
    server.middlewares.use(createOffersHandler(apiOptions));
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
